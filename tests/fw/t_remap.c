#include "drv.h"
static void putc_(char c) { while (!(USART1->SR & 0x80)); USART1->DR = (uint32_t)c; }
static void puts_(const char *s) { while (*s) putc_(*s++); }
static int probe(uint8_t a7) {           /* 1 = ACK, 0 = NACK, -1 = arbitration lost, -2 = hung */
    I2C1->CR1 |= I2C_CR1_START; { int n = 60000; while (!(I2C1->SR1 & I2C_SR1_SB) && --n); if (!n) { I2C1->CR1 &= ~I2C_CR1_START; return -2; } }
    I2C1->DR = (uint8_t)(a7 << 1); int ok = -2;
    for (int n = 30000; n; n--) { uint32_t s = I2C1->SR1; if (s & I2C_SR1_ADDR) { (void)I2C1->SR2; ok = 1; break; } if (s & I2C_SR1_AF) { I2C1->SR1 &= ~I2C_SR1_AF; ok = 0; break; } if (s & (1u << 9)) { I2C1->SR1 &= ~(1u << 9); I2C1->CR1 &= ~I2C_CR1_PE; I2C1->CR1 |= I2C_CR1_PE; return -1; } }
    if (ok == -2) { I2C1->CR1 &= ~I2C_CR1_PE; I2C1->CR1 |= I2C_CR1_PE; return ok; }
    I2C1->CR1 |= I2C_CR1_STOP; { int n = 60000; while ((I2C1->CR1 & I2C_CR1_STOP) && --n); } return ok;
}
static void pr(int v) { puts_(v == 1 ? "ack" : v == 0 ? "nack" : v == -1 ? "arlo" : "hang"); }
int main(void) {
    RCC->APB2ENR |= RCC_APB2ENR_IOPAEN | RCC_APB2ENR_IOPBEN | RCC_APB2ENR_AFIOEN | RCC_APB2ENR_USART1EN;
    RCC->APB1ENR |= RCC_APB1ENR_I2C1EN;
    gpio_cfg(GPIOA, 9, GPIO_AF_PP_2MHZ); USART1->BRR = 8000000 / 115200; USART1->CR1 = (1u << 13) | (1u << 3);
    I2C1->CR2 = 8; I2C1->CCR = 40; I2C1->TRISE = 9; I2C1->CR1 = I2C_CR1_PE;
    puts_("A:"); pr(probe(0x3C)); puts_(" ");                 /* pins still plain GPIO inputs */
    gpio_cfg(GPIOB, 8, GPIO_AF_OD_50MHZ); gpio_cfg(GPIOB, 9, GPIO_AF_OD_50MHZ);
    puts_("B:"); pr(probe(0x3C)); puts_(" ");                 /* AF configured but remap not enabled: bus is PB6/PB7 */
    AFIO->MAPR |= AFIO_MAPR_I2C1_REMAP;
    puts_("C:"); pr(probe(0x3C)); puts_(" ");                 /* remapped to PB8/PB9 */
    gpio_cfg(GPIOB, 9, GPIO_IN_FLOATING);
    puts_("D:"); pr(probe(0x3C)); puts_("\n");               /* SDA released from the peripheral */
    for (;;);
}
