#include "lpc17xx.h"
volatile uint32_t res[8];
#ifndef PRV
#define PRV 0
#endif
void TIMER0_IRQHandler(void){
  LPC_TIM0->IR = 1;
  if (res[0] & 1) LPC_GPIO0->FIOCLR = 1u << 5; else LPC_GPIO0->FIOSET = 1u << 5;
  res[0]++;
}
int main(void){
  LPC_GPIO0->FIODIR = 1u << 5;
#ifdef PCLK1
  LPC_SC->PCLKSEL0 = (LPC_SC->PCLKSEL0 & ~(3u << 2)) | (1u << 2);   /* Timer0 PCLK = CCLK */
#endif
  LPC_TIM0->PR = PRV; LPC_TIM0->MR0 = 999; LPC_TIM0->MCR = 3;       /* interrupt + reset on MR0 */
  NVIC_EnableIRQ(TIMER0_IRQn);
  LPC_TIM0->TCR = 1;
#ifdef T2
  LPC_TIM2->TCR = 1; res[2] = LPC_TIM2->TC;                          /* Timer2 is not powered after reset */
#endif
  for (;;) { res[1] = LPC_TIM0->TC; }
}
