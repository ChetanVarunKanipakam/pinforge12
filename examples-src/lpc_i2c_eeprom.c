#include <stdint.h>
#include "lpc17xx.h"

/* Non-volatile boot counter in an AT24C32 EEPROM module (I2C address 0x50, 2-byte memory addresses, 32-byte pages) on I2C2:
   SDA2 = P0.10, SCL2 = P0.11. Press Stop and Run again: the counter keeps counting because the EEPROM keeps its contents.
   The bare module has NO pull-up resistors, so the two 4.7k resistors in the circuit are required. A write takes about 5 ms
   during which the chip does not acknowledge its address (status 0x20): that is how ACK polling finds out the write is done.
   The driver follows the status codes of the LPC17xx I2C block and every wait has a timeout, so a wiring mistake is reported. */
static volatile uint32_t ms;
void SysTick_Handler(void) { ms++; }

static void putc_(char c) { while (!(LPC_UART0->LSR & LSR_THRE)); LPC_UART0->THR = c; }
static void puts_(const char *s) { while (*s) putc_(*s++); }
static void putu(uint32_t v) { char b[11]; int n = 0; do { b[n++] = '0' + v % 10; v /= 10; } while (v); while (n) putc_(b[--n]); }

#define I2C LPC_I2C2
#define TIMEOUT 30000
static uint32_t wait_si(void) { for (int n = TIMEOUT; n; n--) if (I2C->I2CONSET & I2C_SI) return I2C->I2STAT; return 0xFFFF; }
static uint32_t go(uint32_t clr) { I2C->I2CONCLR = clr; return wait_si(); }
static void stop(void) { I2C->I2CONSET = I2C_STO; I2C->I2CONCLR = I2C_SI; for (int n = TIMEOUT; n && (I2C->I2CONSET & I2C_STO); n--); }
static int fail(uint32_t s) { if (s == 0xFFFF) { I2C->I2CONCLR = I2C_I2EN; I2C->I2CONSET = I2C_I2EN; return 2; } stop(); return 1; }   /* 1 = NACK / unexpected status, 2 = bus fault */

static void i2c_init(void) {
    LPC_SC->PCONP |= PCONP_PCI2C2;
    LPC_PINCON->PINSEL0 = (LPC_PINCON->PINSEL0 & ~((3u << 20) | (3u << 22))) | (2u << 20) | (2u << 22);       /* P0.10 SDA2, P0.11 SCL2 */
    LPC_PINCON->PINMODE0 = (LPC_PINCON->PINMODE0 & ~((3u << 20) | (3u << 22))) | (2u << 20) | (2u << 22);     /* no internal pull: external 4.7k */
    I2C->I2SCLH = 5; I2C->I2SCLL = 5;                      /* PCLK = 1 MHz: 100 kHz */
    I2C->I2CONCLR = I2C_AA | I2C_SI | I2C_STA | I2C_I2EN;
    I2C->I2CONSET = I2C_I2EN;
}
static int addr_phase(uint8_t sla, uint32_t ok) {           /* START (or repeated START already requested) + address byte */
    uint32_t s = wait_si();
    if (s != 0x08 && s != 0x10) return fail(s);
    I2C->I2DAT = sla; s = go(I2C_STA | I2C_SI);
    return s == ok ? 0 : fail(s);
}
static int ee_write(uint16_t a, const uint8_t *d, int n) {
    I2C->I2CONSET = I2C_STA;
    int r = addr_phase(0xA0, 0x18); if (r) return r;
    I2C->I2DAT = a >> 8;   uint32_t s = go(I2C_SI); if (s != 0x28) return fail(s);
    I2C->I2DAT = a & 255;  s = go(I2C_SI);          if (s != 0x28) return fail(s);
    for (int i = 0; i < n; i++) { I2C->I2DAT = d[i]; s = go(I2C_SI); if (s != 0x28) return fail(s); }
    stop(); return 0;
}
static int ee_ready(void) {                                 /* ACK polling: 1 = still writing, 0 = ready */
    I2C->I2CONSET = I2C_STA;
    int r = addr_phase(0xA0, 0x18); if (r == 0) stop(); return r;
}
static int ee_read(uint16_t a, uint8_t *d, int n) {
    I2C->I2CONSET = I2C_STA;
    int r = addr_phase(0xA0, 0x18); if (r) return r;
    I2C->I2DAT = a >> 8;   uint32_t s = go(I2C_SI); if (s != 0x28) return fail(s);
    I2C->I2DAT = a & 255;  s = go(I2C_SI);          if (s != 0x28) return fail(s);
    I2C->I2CONSET = I2C_STA; s = go(I2C_SI);                /* repeated START */
    r = addr_phase(0xA1, 0x40); if (r) return r;
    for (int i = 0; i < n; i++) {
        if (i < n - 1) I2C->I2CONSET = I2C_AA; else I2C->I2CONCLR = I2C_AA;   /* ACK every byte but the last */
        s = go(I2C_SI);
        if (s != (i < n - 1 ? 0x50 : 0x58)) return fail(s);
        d[i] = (uint8_t)I2C->I2DAT;
    }
    stop(); return 0;
}

int main(void) {
    LPC_PINCON->PINSEL0 |= (1u << 4) | (1u << 6);
    LPC_UART0->LCR = LCR_DLAB | 3; LPC_UART0->DLL = 6; LPC_UART0->DLM = 0; LPC_UART0->FDR = (12u << 4) | 1; LPC_UART0->LCR = 3; LPC_UART0->FCR = 7;
    SysTick->LOAD = 4000 - 1; SysTick->CTRL = 7;
    i2c_init();
    puts_("AT24C32 on I2C2 (SDA2 P0.10, SCL2 P0.11)\r\n");
    uint8_t rec[5];
    int r = ee_read(0, rec, 5);
    if (r) { puts_(r == 1 ? "EEPROM does not answer at 0x50: check wiring and address\r\n" : "I2C bus fault: SCL or SDA cannot rise, are the 4.7k pull-ups fitted?\r\n"); for (;;); }
    uint32_t count = (rec[0] == 0xA5) ? ((uint32_t)rec[1] | rec[2] << 8 | rec[3] << 16 | (uint32_t)rec[4] << 24) : 0;
    count++;
    rec[0] = 0xA5; rec[1] = count; rec[2] = count >> 8; rec[3] = count >> 16; rec[4] = count >> 24;
    r = ee_write(0, rec, 5);
    if (r) { puts_("write failed\r\n"); for (;;); }
    uint32_t t0 = ms; int polls = 0;
    while (ee_ready() && ms - t0 < 50) polls++;
    uint32_t dt = ms - t0;                                  /* measure before printing: the UART is slow */
    puts_("EEPROM boot counter = "); putu(count); puts_("  (write cycle took "); putu(dt); puts_(" ms, "); putu(polls); puts_(" ACK polls)\r\n");
    for (;;);
}
