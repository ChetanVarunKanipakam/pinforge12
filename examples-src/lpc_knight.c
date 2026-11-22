#include <stdint.h>
#include "lpc17xx.h"

/* LED bar graph on P2.0 to P2.9: a lit LED sweeps back and forth. CCLK = 4 MHz, SysTick gives the 1 ms time base. */
static volatile uint32_t ms;
void SysTick_Handler(void) { ms++; }

int main(void) {
    LPC_GPIO2->FIODIR |= 0x3FF;                         /* P2.0 - P2.9 outputs */
    SysTick->LOAD = 4000 - 1; SysTick->CTRL = 7;
    int pos = 0, dir = 1; uint32_t next = 80;
    for (;;) {
        if (ms >= next) {
            next += 80;
            LPC_GPIO2->FIOCLR = 0x3FF;
            LPC_GPIO2->FIOSET = 1u << pos;
            if (pos == 9) dir = -1; else if (pos == 0) dir = 1;
            pos += dir;
        }
    }
}
