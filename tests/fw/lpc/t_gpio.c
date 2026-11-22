#include "lpc17xx.h"
volatile uint32_t res[8];
int main(void){
  LPC_GPIO1->FIODIR = (1u << 18) | (1u << 20);
  LPC_GPIO1->FIOSET = (1u << 18) | (1u << 20);
  res[0] = LPC_GPIO1->FIOPIN & 0x140000;            /* both outputs read back high */
  LPC_GPIO1->FIOMASK = 1u << 20;                    /* bit 20 is protected: reads 0 and ignores SET/CLR/PIN writes */
  res[1] = LPC_GPIO1->FIOPIN & 0x140000;
  LPC_GPIO1->FIOCLR = 0xFFFFFFFFu;                  /* clears bit 18 only */
  LPC_GPIO1->FIOMASK = 0;
  res[2] = LPC_GPIO1->FIOSET & 0x140000;            /* FIOSET reads the latch: bit 20 survived */
  res[3] = LPC_GPIO2->FIOPIN & 1;                   /* input with the default pull-up */
  LPC_PINCON->PINMODE4 |= 3;                        /* P2.0 pull-down */
  res[4] = LPC_GPIO2->FIOPIN & 1;
  LPC_GPIO1->FIOPIN = 0x00AA0000;                   /* whole-port write of the latch */
  res[5] = LPC_GPIO1->FIOSET & 0x00FF0000;
#ifdef UNPOWERED
  LPC_SC->PCONP &= ~PCONP_PCGPIO;
  LPC_GPIO1->FIOSET = 1;                            /* ignored: block is unpowered */
#endif
  res[7] = 1;
  for (;;);
}
