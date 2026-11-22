/* Non-volatile boot counter in an AT24C32 EEPROM module (I2C address 0x50, 2-byte memory addresses, 32-byte pages).
   Press Stop and Run again: the counter keeps counting, because the EEPROM keeps its contents (like the real chip).
   Writing takes about 5 ms; during that time the chip does not acknowledge its address, which is how "ACK polling"
   knows when the write has finished. The bare EEPROM module has NO pull-up resistors: the two 4.7k resistors
   on SCL and SDA in the circuit are required, just like on a real breadboard. */
#include <stdint.h>
#include "stm32f1.h"

static volatile uint32_t ms; void SysTick_Handler(void) { ms++; }
static void uart_init(void) { RCC->APB2ENR |= RCC_APB2ENR_IOPAEN | RCC_APB2ENR_USART1EN; gpio_cfg(GPIOA, 9, GPIO_AF_PP_2MHZ); USART1->BRR = 8000000 / 115200; USART1->CR1 = (1u << 13) | (1u << 3); SysTick->LOAD = 8000 - 1; SysTick->CTRL = 7; }
static void putc_(char c) { while (!(USART1->SR & 0x80)); USART1->DR = (uint32_t)c; }
static void puts_(const char *s) { while (*s) putc_(*s++); }

/* ---- minimal I2C2 master driver (PB10 = SCL, PB11 = SDA). Every wait has a timeout, so a missing pull-up or a
   wrong address is reported as an error code instead of hanging the program.  0 = ok, 1 = NACK, 2 = bus fault ---- */
#define TIMEOUT 30000
static int wait_flag(uint32_t f) {
    for (int n = TIMEOUT; n; n--) { uint32_t s = I2C2->SR1; if (s & f) return 0; if (s & I2C_SR1_AF) return 1; if (s & (1u << 9)) return 2; }
    return 2;
}
static void bus_reset(void) { I2C2->CR1 &= ~I2C_CR1_PE; I2C2->CR1 |= I2C_CR1_PE; }
static void stop(void) { I2C2->CR1 |= I2C_CR1_STOP; for (int n = TIMEOUT; n && (I2C2->CR1 & I2C_CR1_STOP); n--); }
static int fail(int r) { if (r == 1) { I2C2->SR1 &= ~I2C_SR1_AF; stop(); } else bus_reset(); return r; }
static void i2c_init(void) {
    RCC->APB2ENR |= RCC_APB2ENR_IOPBEN | RCC_APB2ENR_AFIOEN; RCC->APB1ENR |= RCC_APB1ENR_I2C2EN;
    gpio_cfg(GPIOB, 10, GPIO_AF_OD_50MHZ); gpio_cfg(GPIOB, 11, GPIO_AF_OD_50MHZ);
    I2C2->CR2 = 8; I2C2->CCR = 40; I2C2->TRISE = 9; I2C2->CR1 = I2C_CR1_PE;                 /* 100 kHz at 8 MHz */
}
static int i2c_write(uint8_t a7, const uint8_t *d, int n, int with_stop) {
    int r; I2C2->CR1 |= I2C_CR1_START;
    if ((r = wait_flag(I2C_SR1_SB))) return fail(r);
    I2C2->DR = (uint8_t)(a7 << 1);
    if ((r = wait_flag(I2C_SR1_ADDR))) return fail(r);
    (void)I2C2->SR2;
    for (int i = 0; i < n; i++) { if ((r = wait_flag(I2C_SR1_TXE))) return fail(r); I2C2->DR = d[i]; }
    if (n && (r = wait_flag(I2C_SR1_BTF))) return fail(r);
    if (with_stop) stop();
    return 0;
}
static int i2c_read(uint8_t a7, uint8_t *d, int n) {          /* the three receive sequences of RM0008 */
    int r; I2C2->CR1 |= I2C_CR1_ACK; if (n == 2) I2C2->CR1 |= I2C_CR1_POS;
    I2C2->CR1 |= I2C_CR1_START;
    if ((r = wait_flag(I2C_SR1_SB))) { I2C2->CR1 &= ~I2C_CR1_POS; return fail(r); }
    I2C2->DR = (uint8_t)((a7 << 1) | 1);
    if ((r = wait_flag(I2C_SR1_ADDR))) { I2C2->CR1 &= ~I2C_CR1_POS; return fail(r); }
    if (n == 1) { I2C2->CR1 &= ~I2C_CR1_ACK; (void)I2C2->SR2; I2C2->CR1 |= I2C_CR1_STOP; if ((r = wait_flag(I2C_SR1_RXNE))) return fail(r); d[0] = (uint8_t)I2C2->DR; }
    else if (n == 2) { (void)I2C2->SR2; I2C2->CR1 &= ~I2C_CR1_ACK; if ((r = wait_flag(I2C_SR1_BTF))) return fail(r); I2C2->CR1 |= I2C_CR1_STOP; d[0] = (uint8_t)I2C2->DR; d[1] = (uint8_t)I2C2->DR; }
    else {
        (void)I2C2->SR2;
        while (n > 3) { if ((r = wait_flag(I2C_SR1_BTF))) return fail(r); *d++ = (uint8_t)I2C2->DR; n--; }
        if ((r = wait_flag(I2C_SR1_BTF))) { return fail(r); }
        I2C2->CR1 &= ~I2C_CR1_ACK; *d++ = (uint8_t)I2C2->DR; I2C2->CR1 |= I2C_CR1_STOP;
        *d++ = (uint8_t)I2C2->DR;
        if ((r = wait_flag(I2C_SR1_RXNE))) { return fail(r); }
        *d++ = (uint8_t)I2C2->DR;
    }
    for (int k = TIMEOUT; k && (I2C2->CR1 & I2C_CR1_STOP); k--);
    I2C2->CR1 &= ~I2C_CR1_POS; return 0;
}

#define EE 0x50
static void put_dec(uint32_t v) { char b[11]; int k = 0; do { b[k++] = (char)('0' + v % 10); v /= 10; } while (v); while (k) { putc_(b[--k]); } }
int main(void) {
    uart_init(); i2c_init();
    puts_("AT24C32 boot counter\r\n");
    uint8_t ptr[2] = { 0x00, 0x00 }, rec[5] = { 0 };
    int r = i2c_write(EE, ptr, 2, 0);                         /* set the address pointer to 0x0000 ... */
    if (!r) { r = i2c_read(EE, rec, 5); }                     /* ... then read 5 bytes (repeated START) */
    if (r) { puts_("EEPROM not answering (pull-up resistors? address pins?)\r\n"); for (;;) { } }
    uint32_t count = 0;
    if (rec[0] == 0xA5) { count = (uint32_t)rec[1] | (uint32_t)rec[2] << 8 | (uint32_t)rec[3] << 16 | (uint32_t)rec[4] << 24; }
    else { puts_("blank EEPROM: starting at 0\r\n"); }
    count++;
    uint8_t w[7] = { 0x00, 0x00, 0xA5, (uint8_t)count, (uint8_t)(count >> 8), (uint8_t)(count >> 16), (uint8_t)(count >> 24) };
    r = i2c_write(EE, w, 7, 1);                               /* one page write: 5 data bytes */
    uint32_t t0 = ms; int polls = 0;
    while (i2c_write(EE, 0, 0, 1) != 0 && ms - t0 < 50) { polls++; }   /* ACK polling: NACK while the internal write cycle runs */
    puts_("Boot count: "); put_dec(count); puts_(r ? "  (write failed)" : ""); puts_("\r\n");
    puts_("write cycle took "); put_dec(ms - t0); puts_(" ms, "); put_dec((uint32_t)polls); puts_(" NACKs while polling\r\n");
    puts_("Press Stop, then Run again: the counter survives.\r\n");
    for (;;) { }
}
