#include "drv.h"
#define WAIT(cond) ({ int n = 60000; while (!(cond) && --n); n != 0; })
int main(void) {
    RCC->APB2ENR |= RCC_APB2ENR_IOPBEN | RCC_APB2ENR_AFIOEN; RCC->APB1ENR |= RCC_APB1ENR_I2C1EN;
    /* 1. CR2.FREQ = 0: the peripheral cannot make a clock, START never completes */
    I2C1->CR2 = 0; I2C1->CCR = 40; I2C1->CR1 = I2C_CR1_PE; I2C1->CR1 |= I2C_CR1_START;
    res[0] = WAIT(I2C1->SR1 & I2C_SR1_SB);
    I2C1->CR1 &= ~I2C_CR1_PE; I2C1->CR1 &= ~I2C_CR1_START;
    /* 2. fast mode DUTY=1 needs 10 MHz, PCLK1 is 8 MHz */
    I2C1->CR2 = 8; I2C1->CCR = I2C_CCR_FS | I2C_CCR_DUTY | 2; I2C1->CR1 = I2C_CR1_PE; I2C1->CR1 |= I2C_CR1_START;
    res[1] = WAIT(I2C1->SR1 & I2C_SR1_SB);
    I2C1->CR1 &= ~I2C_CR1_PE;
    /* 3. valid settings: START works, then the address phase meets whatever the physical layer says */
    I2C1->CR2 = 8; I2C1->CCR = 40; I2C1->TRISE = 9; I2C1->CR1 = I2C_CR1_PE;
    I2C1->CR1 |= I2C_CR1_START; res[2] = WAIT(I2C1->SR1 & I2C_SR1_SB);
    I2C1->DR = 0xA2;
    res[3] = WAIT(I2C1->SR1 & (I2C_SR1_ADDR | I2C_SR1_AF | (1u << 9)));    /* ADDR, AF or ARLO */
    res[4] = I2C1->SR1; res[5] = I2C1->SR2;
    I2C1->CR1 |= I2C_CR1_STOP; res[6] = WAIT(!(I2C1->CR1 & I2C_CR1_STOP)); res[7] = I2C1->SR2;
    /* 4. software reset through RCC APB1RSTR clears the registers */
    I2C1->CCR = 0x1234 & 0xCFFF; RCC->APB1RSTR |= (1u << 21); RCC->APB1RSTR &= ~(1u << 21);
    res[8] = I2C1->CCR;
    res[31] = 0xD0D0; for (;;);
}
