#include "lpc17xx.h"
volatile uint32_t res[12];
void ADC_IRQHandler(void){ res[9]++; res[10] = LPC_ADC->ADGDR; }          /* reading ADGDR clears the global DONE flag */
int main(void){
  SysTick->LOAD = 0xFFFFFF; SysTick->CTRL = 5;
#ifndef NOPOWER
  LPC_SC->PCONP |= PCONP_PCADC;
#endif
#ifndef NOPIN
  LPC_PINCON->PINSEL3 |= 3u << 30;                                         /* P1.31 = AD0.5 */
#ifndef NOPULLMODE
  LPC_PINCON->PINMODE3 = (LPC_PINCON->PINMODE3 & ~(3u << 30)) | (2u << 30);   /* neither pull-up nor pull-down */
#endif
#endif
#ifdef BURST
  LPC_PINCON->PINSEL1 |= 1u << 16;                                         /* P0.24 = AD0.1 */
  LPC_PINCON->PINMODE1 = (LPC_PINCON->PINMODE1 & ~(3u << 16)) | (2u << 16);
  uint32_t cr = (1u << 1) | (1u << 5) | (3u << 8) | (1u << 21);
  LPC_ADC->ADCR = cr | (1u << 16);                                         /* burst over channels 1 and 5 */
  uint32_t t0 = SysTick->VAL; while (((t0 - SysTick->VAL) & 0xFFFFFF) < 8000);
  res[2] = LPC_ADC->ADSTAT;                                                /* nothing was read: overruns */
  res[0] = LPC_ADC->ADDR1; res[1] = LPC_ADC->ADDR5;
  LPC_ADC->ADCR = cr;                                                      /* stop burst */
#else
  uint32_t cr = (1u << 5) | (3u << 8) | (1u << 21);                        /* channel 5, ADC clock = PCLK/4 = 250 kHz, operational */
  LPC_ADC->ADCR = cr;
#ifdef IRQ
  LPC_ADC->ADINTEN = 0x100; NVIC_EnableIRQ(ADC_IRQn);
#endif
  uint32_t t0 = SysTick->VAL;
  LPC_ADC->ADCR = cr | (1u << 24);                                         /* start now */
#ifdef IRQ
  uint32_t g = 20000; while (!res[9] && --g);
  res[4] = (t0 - SysTick->VAL) & 0xFFFFFF;
#else
  uint32_t v, g = 20000; do { v = LPC_ADC->ADGDR; } while (!(v & (1u << 31)) && --g);
  res[4] = (t0 - SysTick->VAL) & 0xFFFFFF;
  res[0] = g ? v : 0;
  res[2] = LPC_ADC->ADSTAT;                                                /* ADDR5 not read yet: DONE5 */
  res[1] = LPC_ADC->ADDR5;
  res[3] = LPC_ADC->ADSTAT;                                                /* reading ADDR5 cleared DONE */
#endif
#endif
  res[7] = 1;
  for (;;);
}
