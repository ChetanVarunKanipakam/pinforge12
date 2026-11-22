#include "lpc17xx.h"
volatile uint32_t res[8];
void EINT0_IRQHandler(void){ LPC_SC->EXTINT = 1; res[0]++; }
void EINT3_IRQHandler(void){
  if (LPC_GPIOINT->IO0IntStatR & (1u << 5)) { LPC_GPIOINT->IO0IntClr = 1u << 5; res[1]++; }
  if (LPC_GPIOINT->IO0IntStatF & (1u << 6)) { LPC_GPIOINT->IO0IntClr = 1u << 6; res[2]++; }
}
int main(void){
  LPC_PINCON->PINSEL4 |= 1u << 20;                    /* P2.10 = EINT0 */
  LPC_SC->EXTMODE = 1; LPC_SC->EXTPOLAR = 0;          /* edge, falling */
  LPC_GPIOINT->IO0IntEnR = 1u << 5; LPC_GPIOINT->IO0IntEnF = 1u << 6;
  NVIC_EnableIRQ(EINT0_IRQn); NVIC_EnableIRQ(EINT3_IRQn);
  res[7] = 1;
  for (;;);
}
