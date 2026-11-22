#include "lpc17xx.h"
volatile uint32_t res[8];
int main(void){ res[0]=(uint32_t)&LPC_SC->PLL0CON; res[1]=(uint32_t)&LPC_SC->PCONP; res[2]=(uint32_t)&LPC_SC->CCLKCFG; res[3]=(uint32_t)&LPC_SC->PCLKSEL1;
 res[4]=(uint32_t)&LPC_PINCON->PINMODE0; res[5]=(uint32_t)&LPC_UART0->TER; res[6]=(uint32_t)&LPC_TIM0->CTCR; res[7]=(uint32_t)&LPC_GPIO1->FIOCLR; for(;;); }
