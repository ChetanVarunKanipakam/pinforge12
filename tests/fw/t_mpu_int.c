#include "i2c2.h"
static volatile uint32_t edges;
void EXTI1_IRQHandler(void) { EXTI->PR = (1u << 1); edges++; }
int main(void) {
    sys_init(); i2c_init(100000);
    reg_wr(0x68, 0x6B, 0x00); delay_ms(50);
    reg_wr(0x68, 0x1A, 0x01); reg_wr(0x68, 0x19, 9);          /* DLPF on: 1 kHz base, divider 9 -> 100 Hz */
    reg_wr(0x68, 0x38, 0x01);                                  /* data-ready interrupt */
    AFIO->EXTICR[0] = (AFIO->EXTICR[0] & ~(0xFu << 4)) | (1u << 4);   /* PB1 */
    EXTI->RTSR |= (1u << 1); EXTI->IMR |= (1u << 1); NVIC_EnableIRQ(EXTI1_IRQn);
    gpio_cfg(GPIOB, 1, GPIO_IN_FLOATING);
    uint32_t t0 = ms; edges = 0; while (ms - t0 < 1000) { }
    u_puts("EDGES_100HZ="); u_dec((int32_t)edges); u_puts("\r\n");
    reg_wr(0x68, 0x37, 0x20);                                  /* latched: stays high until INT_STATUS is read */
    delay_ms(30); int hi1 = (GPIOB->IDR >> 1) & 1; rd8(0x68, 0x3A); delay_ms(1); int hi2 = (GPIOB->IDR >> 1) & 1;
    u_puts("LATCH before="); u_dec(hi1); u_puts(" after_read="); u_dec(hi2); u_puts("\r\nDONE\r\n");
    for (;;);
}
