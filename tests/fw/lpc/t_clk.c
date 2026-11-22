#include "lpc17xx.h"
volatile uint32_t res[8];
int main(void){
#ifndef NOFLASH
  LPC_SC->FLASHCFG = (4u << 12) | 0x3A;            /* 5 flash clocks: up to 100 MHz */
#endif
  LPC_SC->SCS = SCS_OSCEN; while (!(LPC_SC->SCS & SCS_OSCSTAT));
  LPC_SC->CLKSRCSEL = 1;                            /* main oscillator, 12 MHz */
  LPC_SC->PLL0CFG = 49u | (2u << 16);               /* M=50, N=3  ->  Fcco = 400 MHz */
  LPC_SC->PLL0FEED = 0xAA; LPC_SC->PLL0FEED = 0x55;
  LPC_SC->PLL0CON = 1;
  LPC_SC->PLL0FEED = 0xAA; LPC_SC->PLL0FEED = 0x55;
  LPC_SC->CCLKCFG = 3;                              /* 400 / 4 = 100 MHz */
  while (!(LPC_SC->PLL0STAT & PLL0STAT_PLOCK));
  res[2] = LPC_SC->PLL0STAT;                        /* before connect */
  LPC_SC->PLL0CON = 3;
  LPC_SC->PLL0FEED = 0xAA; LPC_SC->PLL0FEED = 0x55;
  res[0] = LPC_SC->PLL0STAT;
  NVIC_SetPriority(TIMER0_IRQn, 31); res[3] = *(volatile uint8_t *)(0xE000E400 + 1);   /* only 5 priority bits exist */
  res[1] = 1;
  for (;;);
}
