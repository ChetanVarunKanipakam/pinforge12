#include <stdint.h>
#include "lpc17xx.h"

/* LED on P2.0, push button on P2.1 (to GND, internal pull-up), serial console on UART0 (P0.2 / P0.3). CCLK = 4 MHz from the internal RC. */
static volatile uint32_t ms;
void SysTick_Handler(void) { ms++; }

static void uart0_init(void) {
    LPC_PINCON->PINSEL0 |= (1u << 4) | (1u << 6);       /* P0.2 = TXD0, P0.3 = RXD0 */
    LPC_UART0->LCR = LCR_DLAB | 3;                      /* 8N1, open the divisor latch */
    LPC_UART0->DLL = 6; LPC_UART0->DLM = 0;             /* PCLK = CCLK / 4 = 1 MHz: 1e6 / (16 * 6 * (1 + 1/12)) = 9615 baud */
    LPC_UART0->FDR = (12u << 4) | 1;
    LPC_UART0->LCR = 3;
    LPC_UART0->FCR = 7;                                 /* enable and clear the FIFOs */
}
static void putc_(char c) { while (!(LPC_UART0->LSR & LSR_THRE)); LPC_UART0->THR = c; }
static void puts_(const char *s) { while (*s) putc_(*s++); }
static void putu(uint32_t v) { char b[11]; int n = 0; do { b[n++] = '0' + v % 10; v /= 10; } while (v); while (n) putc_(b[--n]); }

int main(void) {
    LPC_GPIO2->FIODIR |= 1u << 0;                       /* P2.0 output */
    SysTick->LOAD = 4000 - 1;                           /* 1 ms at 4 MHz */
    SysTick->CTRL = 7;                                  /* CCLK, interrupt, enable */
    uart0_init();
    puts_("PinForge LPC1768: blink + button + UART0\r\n");
    uint32_t next = 500, last = 0, presses = 0;
    int led = 0, prev = 1;
    for (;;) {
        if (ms >= next) {
            next += 500; led = !led;
            if (led) LPC_GPIO2->FIOSET = 1u << 0; else LPC_GPIO2->FIOCLR = 1u << 0;
        }
        int now = (LPC_GPIO2->FIOPIN >> 1) & 1;         /* P2.1 */
        if (!now && prev) { presses++; puts_("button pressed, count = "); putu(presses); puts_("\r\n"); }
        prev = now;
        if (ms - last >= 2000) { last = ms; puts_("uptime "); putu(ms / 1000); puts_(" s\r\n"); }
    }
}
