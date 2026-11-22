#include <stdint.h>
#include "stm32f1.h"
#define SPIN 300000
static volatile uint32_t ms; void SysTick_Handler(void) { ms++; }
static void delay_ms(uint32_t d) { uint32_t t = ms + d; while ((int32_t)(ms - t) < 0) { } }
static void u_putc(char c) { while (!(USART1->SR & 0x80)); USART1->DR = (uint32_t)c; }
static void u_puts(const char *s) { while (*s) u_putc(*s++); }
static void u_hex(uint32_t v, int n) { for (int i = n - 1; i >= 0; i--) u_putc("0123456789ABCDEF"[(v >> (4 * i)) & 15]); }
static void u_dec(int32_t v) { char b[12]; int k = 0; uint32_t u; if (v < 0) { u_putc('-'); u = (uint32_t)(-v); } else u = (uint32_t)v; do { b[k++] = (char)('0' + u % 10); u /= 10; } while (u); while (k) u_putc(b[--k]); }
static void sys_init(void) {
    RCC->APB2ENR |= RCC_APB2ENR_IOPAEN | RCC_APB2ENR_IOPBEN | RCC_APB2ENR_AFIOEN | RCC_APB2ENR_USART1EN; RCC->APB1ENR |= RCC_APB1ENR_I2C2EN;
    gpio_cfg(GPIOA, 9, GPIO_AF_PP_2MHZ); USART1->BRR = 8000000 / 115200; USART1->CR1 = (1u << 13) | (1u << 3);
    gpio_cfg(GPIOB, 10, GPIO_AF_OD_50MHZ); gpio_cfg(GPIOB, 11, GPIO_AF_OD_50MHZ);
    SysTick->LOAD = 8000 - 1; SysTick->CTRL = 7;
}
static void i2c_init(uint32_t hz) {
    I2C2->CR1 = 0; I2C2->CR2 = 8;
    if (hz <= 100000) { I2C2->CCR = 4000000 / hz; I2C2->TRISE = 9; } else { I2C2->CCR = I2C_CCR_FS | (8000000 / (3 * hz) + 1); I2C2->TRISE = 3; }
    I2C2->CR1 = I2C_CR1_PE;
}
/* return codes: 0 ok, 1 NACK, 2 timeout/hang, 3 arbitration lost */
static int w_flag(uint32_t f) { for (int n = SPIN; n; n--) { uint32_t s = I2C2->SR1; if (s & f) return 0; if (s & I2C_SR1_AF) return 1; if (s & (1u << 9)) return 3; } return 2; }
static void do_stop(void) { I2C2->CR1 |= I2C_CR1_STOP; for (int n = SPIN; n && (I2C2->CR1 & I2C_CR1_STOP); n--); }
static void clr_err(void) { I2C2->SR1 &= ~((1u << 10) | (1u << 9) | (1u << 8)); }
static int addr_phase(uint8_t a8) {
    I2C2->CR1 |= I2C_CR1_START;
    if (w_flag(I2C_SR1_SB)) { return 2; }
    I2C2->DR = a8;
    int r = w_flag(I2C_SR1_ADDR);
    if (r == 0) { (void)I2C2->SR2; return 0; }
    if (r == 1) { clr_err(); do_stop(); return 1; }
    if (r == 3) { clr_err(); return 3; }
    return 2;
}
static int i2c_wr(uint8_t a7, const uint8_t *d, int n, int stop) {
    int r = addr_phase((uint8_t)(a7 << 1)); if (r) return r;
    for (int i = 0; i < n; i++) { r = w_flag(I2C_SR1_TXE); if (r) { if (r == 1) { clr_err(); do_stop(); } return r; } I2C2->DR = d[i]; }
    if (n == 0) { if (stop) do_stop(); return 0; }
    r = w_flag(I2C_SR1_BTF); if (r) { if (r == 1) { clr_err(); do_stop(); } return r; }
    if (stop) do_stop();
    return 0;
}
static int i2c_rd(uint8_t a7, uint8_t *d, int n) {          /* master receive, N=1 / N=2 / N>2 sequences from RM0008 */
    int r;
    I2C2->CR1 |= I2C_CR1_ACK; if (n == 2) I2C2->CR1 |= I2C_CR1_POS;
    I2C2->CR1 |= I2C_CR1_START; if (w_flag(I2C_SR1_SB)) { I2C2->CR1 &= ~I2C_CR1_POS; return 2; }
    I2C2->DR = (uint8_t)((a7 << 1) | 1);
    r = w_flag(I2C_SR1_ADDR);
    if (r) { if (r == 1) { clr_err(); do_stop(); } if (r == 3) clr_err(); I2C2->CR1 &= ~I2C_CR1_POS; return r; }
    if (n == 1) {
        I2C2->CR1 &= ~I2C_CR1_ACK; (void)I2C2->SR2; I2C2->CR1 |= I2C_CR1_STOP;
        if ((r = w_flag(I2C_SR1_RXNE))) return r; d[0] = (uint8_t)I2C2->DR;
    } else if (n == 2) {
        (void)I2C2->SR2; I2C2->CR1 &= ~I2C_CR1_ACK;
        if ((r = w_flag(I2C_SR1_BTF))) return r; I2C2->CR1 |= I2C_CR1_STOP; d[0] = (uint8_t)I2C2->DR; d[1] = (uint8_t)I2C2->DR;
    } else {
        (void)I2C2->SR2;
        while (n > 3) { if ((r = w_flag(I2C_SR1_BTF))) return r; *d++ = (uint8_t)I2C2->DR; n--; }
        if ((r = w_flag(I2C_SR1_BTF))) return r; I2C2->CR1 &= ~I2C_CR1_ACK; *d++ = (uint8_t)I2C2->DR; I2C2->CR1 |= I2C_CR1_STOP;
        *d++ = (uint8_t)I2C2->DR; if ((r = w_flag(I2C_SR1_RXNE))) return r; *d++ = (uint8_t)I2C2->DR;
    }
    for (int k = SPIN; k && (I2C2->CR1 & I2C_CR1_STOP); k--);
    I2C2->CR1 &= ~I2C_CR1_POS; return 0;
}
static int reg_rd(uint8_t a7, const uint8_t *reg, int rn, uint8_t *d, int n) {     /* write pointer (rn bytes), repeated START, read n bytes */
    int r = i2c_wr(a7, reg, rn, 0); if (r) return r; return i2c_rd(a7, d, n);
}
static int reg_wr(uint8_t a7, uint8_t reg, uint8_t v) { uint8_t b[2] = { reg, v }; return i2c_wr(a7, b, 2, 1); }
static int rd8(uint8_t a7, uint8_t reg) { uint8_t v = 0xEE; int r = reg_rd(a7, &reg, 1, &v, 1); return r ? -r : v; }
