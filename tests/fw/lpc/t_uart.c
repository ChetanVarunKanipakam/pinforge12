#include "lpc17xx.h"
volatile uint32_t res[16];
volatile uint32_t n, txi; static const char *msg = "OK";
void UART0_IRQHandler(void){
  uint32_t iir = LPC_UART0->IIR; res[8] = iir;
  switch ((iir >> 1) & 7) {
    case 2: case 6: while (LPC_UART0->LSR & LSR_RDR) { if (n < 6) res[n++] = LPC_UART0->RBR; else (void)LPC_UART0->RBR; } break;
    case 1: if (msg[txi]) LPC_UART0->THR = msg[txi++]; else LPC_UART0->IER = 1; break;
  }
}
int main(void){
#ifndef NOPIN
  LPC_PINCON->PINSEL0 |= (1u << 4) | (1u << 6);     /* P0.2 = TXD0, P0.3 = RXD0 */
#endif
  LPC_UART0->LCR = LCR_DLAB | 3; LPC_UART0->DLL = 6; LPC_UART0->DLM = 0; LPC_UART0->LCR = 3;
  LPC_UART0->FCR = 7;
#ifdef POLL
  LPC_UART0->THR = 'H'; LPC_UART0->THR = 'i';
  res[10] = LPC_UART0->LSR;                           /* right after the writes: second byte waits in the FIFO */
  while (!(LPC_UART0->LSR & LSR_TEMT));
  res[11] = LPC_UART0->LSR;
#endif
#ifdef TXINT
  LPC_UART0->IER = 3; NVIC_EnableIRQ(UART0_IRQn);     /* THRE interrupt drives the transmit */
#endif
#ifdef RXINT
  LPC_UART0->IER = 1; NVIC_EnableIRQ(UART0_IRQn);
#endif
  res[15] = 1;
  for (;;);
}
