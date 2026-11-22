#include <stdint.h>
#include "lpc17xx.h"

/* Interrupts: Timer0 match toggles the LED on P2.0 every 500 ms; a falling edge on P2.1 raises a GPIO interrupt (EINT3 vector);
   the main loop reports both over UART0. CCLK = 4 MHz, Timer0 runs from PCLK = 1 MHz. */
static volatile uint32_t ticks, presses;
static volatile int led;

void TIMER0_IRQHandler(void) {
    LPC_TIM0->IR = 1;                                   /* clear the MR0 flag */
    ticks++; led = !led;
    if (led) LPC_GPIO2->FIOSET = 1u << 0; else LPC_GPIO2->FIOCLR = 1u << 0;
}
void EINT3_IRQHandler(void) {
    if (LPC_GPIOINT->IO2IntStatF & (1u << 1)) { LPC_GPIOINT->IO2IntClr = 1u << 1; presses++; }
}
static void putc_(char c) { while (!(LPC_UART0->LSR & LSR_THRE)); LPC_UART0->THR = c; }
static void puts_(const char *s) { while (*s) putc_(*s++); }
static void putu(uint32_t v) { char b[11]; int n = 0; do { b[n++] = '0' + v % 10; v /= 10; } while (v); while (n) putc_(b[--n]); }

int main(void) {
    LPC_PINCON->PINSEL0 |= (1u << 4) | (1u << 6);
    LPC_UART0->LCR = LCR_DLAB | 3; LPC_UART0->DLL = 6; LPC_UART0->DLM = 0; LPC_UART0->FDR = (12u << 4) | 1; LPC_UART0->LCR = 3; LPC_UART0->FCR = 7;
    LPC_GPIO2->FIODIR |= 1u << 0;
    LPC_TIM0->PR = 999;                                 /* 1 MHz / 1000 = 1 kHz timer tick */
    LPC_TIM0->MR0 = 499;                                /* 500 ticks */
    LPC_TIM0->MCR = 3;                                  /* interrupt and reset on MR0 */
    LPC_TIM0->TCR = 1;
    NVIC_EnableIRQ(TIMER0_IRQn);
    LPC_GPIOINT->IO2IntEnF = 1u << 1;                   /* falling edge on P2.1 */
    NVIC_EnableIRQ(EINT3_IRQn);
    puts_("Timer0 + GPIO interrupts\r\n");
    uint32_t seenT = 0, seenP = 0;
    for (;;) {
        if (ticks != seenT) { seenT = ticks; puts_("Timer0 tick "); putu(seenT); puts_("\r\n"); }
        if (presses != seenP) { seenP = presses; puts_("button interrupt, count = "); putu(seenP); puts_("\r\n"); }
    }
}
