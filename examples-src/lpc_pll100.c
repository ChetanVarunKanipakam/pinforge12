#include <stdint.h>
#include "lpc17xx.h"

/* Clock the chip at 100 MHz: 12 MHz crystal x 50 / 3 x 2 = 400 MHz PLL0 output, CCLK = 400 / 4 = 100 MHz, PCLK = 25 MHz.
   Flash timing has to be raised first (FLASHTIM = 4), then PLL0 is enabled, locked and connected, each change needs the AA / 55 feed. */
static volatile uint32_t ms;
void SysTick_Handler(void) { ms++; }
static void feed(void) { LPC_SC->PLL0FEED = 0xAA; LPC_SC->PLL0FEED = 0x55; }

static void clock_100mhz(void) {
    LPC_SC->FLASHCFG = (4u << 12) | 0x3A;
    LPC_SC->SCS = SCS_OSCEN;  while (!(LPC_SC->SCS & SCS_OSCSTAT));
    LPC_SC->CLKSRCSEL = 1;                              /* main oscillator */
    LPC_SC->PLL0CFG = 49u | (2u << 16);                 /* M = 50, N = 3 */
    feed();
    LPC_SC->PLL0CON = 1; feed();
    LPC_SC->CCLKCFG = 3;
    while (!(LPC_SC->PLL0STAT & PLL0STAT_PLOCK));
    LPC_SC->PLL0CON = 3; feed();                        /* connect */
}
static void putc_(char c) { while (!(LPC_UART0->LSR & LSR_THRE)); LPC_UART0->THR = c; }
static void puts_(const char *s) { while (*s) putc_(*s++); }
static void putu(uint32_t v) { char b[11]; int n = 0; do { b[n++] = '0' + v % 10; v /= 10; } while (v); while (n) putc_(b[--n]); }

int main(void) {
    clock_100mhz();
    LPC_PINCON->PINSEL0 |= (1u << 4) | (1u << 6);
    LPC_UART0->LCR = LCR_DLAB | 3;                      /* PCLK = 25 MHz: 25e6 / (16 * 12 * (1 + 2/15)) = 114889 baud (115200 -0.3 %) */
    LPC_UART0->DLL = 12; LPC_UART0->DLM = 0; LPC_UART0->FDR = (15u << 4) | 2;
    LPC_UART0->LCR = 3; LPC_UART0->FCR = 7;
    LPC_GPIO2->FIODIR |= 1u << 0;
    SysTick->LOAD = 100000 - 1;                         /* 1 ms at 100 MHz */
    SysTick->CTRL = 7;
    puts_("CCLK = 100 MHz (PLL0 locked and connected), UART0 at 115200 baud\r\n");
    uint32_t next = 500; int led = 0;
    for (;;) {
        if (ms >= next) {
            next += 500; led = !led;
            if (led) LPC_GPIO2->FIOSET = 1u << 0; else LPC_GPIO2->FIOCLR = 1u << 0;
            puts_("t = "); putu(ms); puts_(" ms\r\n");
        }
    }
}
