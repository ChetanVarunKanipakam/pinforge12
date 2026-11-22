#include <stdint.h>
#include "lpc17xx.h"

/* Potentiometer on P1.31 = AD0.5. The reading is printed on UART0 twice a second; the LED on P2.0 lights above half scale.
   CCLK = 4 MHz, PCLK = 1 MHz, ADC clock = PCLK / 4 = 250 kHz, one conversion = 65 ADC clocks = 260 us. */
static volatile uint32_t ms;
void SysTick_Handler(void) { ms++; }

static void putc_(char c) { while (!(LPC_UART0->LSR & LSR_THRE)); LPC_UART0->THR = c; }
static void puts_(const char *s) { while (*s) putc_(*s++); }
static void putu(uint32_t v) { char b[11]; int n = 0; do { b[n++] = '0' + v % 10; v /= 10; } while (v); while (n) putc_(b[--n]); }

static void adc_init(void) {
    LPC_SC->PCONP |= PCONP_PCADC;                                    /* power the ADC block */
    LPC_PINCON->PINSEL3 |= 3u << 30;                                 /* P1.31 = AD0.5 */
    LPC_PINCON->PINMODE3 = (LPC_PINCON->PINMODE3 & ~(3u << 30)) | (2u << 30);   /* neither pull-up nor pull-down */
    LPC_ADC->ADCR = (1u << 5) | (3u << 8) | ADCR_PDN;                /* channel 5, CLKDIV = 3, operational */
}
static uint32_t adc_read(void) {
    LPC_ADC->ADCR |= ADCR_START_NOW;
    uint32_t v;
    do { v = LPC_ADC->ADGDR; } while (!(v & ADGDR_DONE));            /* reading ADGDR clears DONE */
    LPC_ADC->ADCR &= ~(7u << 24);
    return (v >> 4) & 0xFFF;
}

int main(void) {
    LPC_PINCON->PINSEL0 |= (1u << 4) | (1u << 6);
    LPC_UART0->LCR = LCR_DLAB | 3; LPC_UART0->DLL = 6; LPC_UART0->DLM = 0; LPC_UART0->FDR = (12u << 4) | 1; LPC_UART0->LCR = 3; LPC_UART0->FCR = 7;
    LPC_GPIO2->FIODIR |= 1u << 0;
    SysTick->LOAD = 4000 - 1; SysTick->CTRL = 7;
    adc_init();
    puts_("ADC on P1.31 (AD0.5), 12 bit\r\n");
    uint32_t next = 500;
    for (;;) {
        if (ms >= next) {
            next += 500;
            uint32_t v = adc_read();
            if (v > 2048) LPC_GPIO2->FIOSET = 1u << 0; else LPC_GPIO2->FIOCLR = 1u << 0;
            puts_("AD0.5 = "); putu(v); puts_("  ("); putu(v * 3300 / 4095); puts_(" mV)\r\n");
        }
    }
}
