/* Real-time clock: a DS3231 module (I2C address 0x68) shown on a 16x2 LCD with an I2C backpack (PCF8574, address 0x27).
   Both sit on I2C2 (SCL = PB10, SDA = PB11). The LCD needs 5 V, so both modules are powered from the 5 V pin.
   The DS3231 starts from your computer's clock; set another start time in its inspector. */
#include <stdint.h>
#include "stm32f1.h"

static volatile uint32_t ms; void SysTick_Handler(void) { ms++; }
static void delay_ms(uint32_t d) { uint32_t t = ms + d; while ((int32_t)(ms - t) < 0) { } }

/* ---- minimal I2C2 master driver (PB10 = SCL, PB11 = SDA). Every wait has a timeout, so a missing pull-up or a
   wrong address is reported as an error code instead of hanging the program.  0 = ok, 1 = NACK, 2 = bus fault ---- */
#define TIMEOUT 30000
static int wait_flag(uint32_t f) {
    for (int n = TIMEOUT; n; n--) { uint32_t s = I2C2->SR1; if (s & f) return 0; if (s & I2C_SR1_AF) return 1; if (s & (1u << 9)) return 2; }
    return 2;
}
static void bus_reset(void) { I2C2->CR1 &= ~I2C_CR1_PE; I2C2->CR1 |= I2C_CR1_PE; }
static void stop(void) { I2C2->CR1 |= I2C_CR1_STOP; for (int n = TIMEOUT; n && (I2C2->CR1 & I2C_CR1_STOP); n--); }
static int fail(int r) { if (r == 1) { I2C2->SR1 &= ~I2C_SR1_AF; stop(); } else bus_reset(); return r; }
static void i2c_init(void) {
    RCC->APB2ENR |= RCC_APB2ENR_IOPBEN | RCC_APB2ENR_AFIOEN; RCC->APB1ENR |= RCC_APB1ENR_I2C2EN;
    gpio_cfg(GPIOB, 10, GPIO_AF_OD_50MHZ); gpio_cfg(GPIOB, 11, GPIO_AF_OD_50MHZ);
    I2C2->CR2 = 8; I2C2->CCR = 40; I2C2->TRISE = 9; I2C2->CR1 = I2C_CR1_PE;                 /* 100 kHz at 8 MHz */
}
static int i2c_write(uint8_t a7, const uint8_t *d, int n, int with_stop) {
    int r; I2C2->CR1 |= I2C_CR1_START;
    if ((r = wait_flag(I2C_SR1_SB))) return fail(r);
    I2C2->DR = (uint8_t)(a7 << 1);
    if ((r = wait_flag(I2C_SR1_ADDR))) return fail(r);
    (void)I2C2->SR2;
    for (int i = 0; i < n; i++) { if ((r = wait_flag(I2C_SR1_TXE))) return fail(r); I2C2->DR = d[i]; }
    if (n && (r = wait_flag(I2C_SR1_BTF))) return fail(r);
    if (with_stop) stop();
    return 0;
}
static int i2c_read(uint8_t a7, uint8_t *d, int n) {          /* the three receive sequences of RM0008 */
    int r; I2C2->CR1 |= I2C_CR1_ACK; if (n == 2) I2C2->CR1 |= I2C_CR1_POS;
    I2C2->CR1 |= I2C_CR1_START;
    if ((r = wait_flag(I2C_SR1_SB))) { I2C2->CR1 &= ~I2C_CR1_POS; return fail(r); }
    I2C2->DR = (uint8_t)((a7 << 1) | 1);
    if ((r = wait_flag(I2C_SR1_ADDR))) { I2C2->CR1 &= ~I2C_CR1_POS; return fail(r); }
    if (n == 1) { I2C2->CR1 &= ~I2C_CR1_ACK; (void)I2C2->SR2; I2C2->CR1 |= I2C_CR1_STOP; if ((r = wait_flag(I2C_SR1_RXNE))) return fail(r); d[0] = (uint8_t)I2C2->DR; }
    else if (n == 2) { (void)I2C2->SR2; I2C2->CR1 &= ~I2C_CR1_ACK; if ((r = wait_flag(I2C_SR1_BTF))) return fail(r); I2C2->CR1 |= I2C_CR1_STOP; d[0] = (uint8_t)I2C2->DR; d[1] = (uint8_t)I2C2->DR; }
    else {
        (void)I2C2->SR2;
        while (n > 3) { if ((r = wait_flag(I2C_SR1_BTF))) return fail(r); *d++ = (uint8_t)I2C2->DR; n--; }
        if ((r = wait_flag(I2C_SR1_BTF))) { return fail(r); }
        I2C2->CR1 &= ~I2C_CR1_ACK; *d++ = (uint8_t)I2C2->DR; I2C2->CR1 |= I2C_CR1_STOP;
        *d++ = (uint8_t)I2C2->DR;
        if ((r = wait_flag(I2C_SR1_RXNE))) { return fail(r); }
        *d++ = (uint8_t)I2C2->DR;
    }
    for (int k = TIMEOUT; k && (I2C2->CR1 & I2C_CR1_STOP); k--);
    I2C2->CR1 &= ~I2C_CR1_POS; return 0;
}
static int read_regs(uint8_t a7, uint8_t reg, uint8_t *d, int n) {      /* write the register number, repeated START, read n bytes */
    int r = i2c_write(a7, &reg, 1, 0); if (r) return r; return i2c_read(a7, d, n);
}

#define LCD 0x27
#define RTC 0x68
static void pcf(uint8_t v) { i2c_write(LCD, &v, 1, 1); }
static void nib(uint8_t n, uint8_t rs) { uint8_t b = (uint8_t)((n << 4) | 0x08 | rs); pcf((uint8_t)(b | 4)); pcf(b); }   /* P3 = backlight, E pulse on P2 */
static void lcd_byte(uint8_t v, uint8_t rs) { nib(v >> 4, rs); nib(v & 15, rs); }
static void lcd_init(void) {
    delay_ms(50); nib(3, 0); delay_ms(5); nib(3, 0); delay_ms(1); nib(3, 0); nib(2, 0);       /* HD44780: switch to 4-bit mode */
    lcd_byte(0x28, 0); lcd_byte(0x0C, 0); lcd_byte(0x06, 0); lcd_byte(0x01, 0); delay_ms(3);
}
static void lcd_at(int row, int col) { lcd_byte((uint8_t)(0x80 | (row ? 0x40 : 0) | col), 0); }
static void lcd_str(const char *s) { while (*s) { lcd_byte((uint8_t)*s++, 1); } }
static void two(char *o, int v) { o[0] = (char)('0' + v / 10); o[1] = (char)('0' + v % 10); }

int main(void) {
    RCC->APB2ENR |= RCC_APB2ENR_IOPAEN; SysTick->LOAD = 8000 - 1; SysTick->CTRL = 7;
    i2c_init(); lcd_init();
    static const char *days[] = { "???", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" };
    int last = -1;
    for (;;) {
        uint8_t t[7];
        if (read_regs(RTC, 0x00, t, 7)) { lcd_at(0, 0); lcd_str("RTC not found   "); delay_ms(500); continue; }
        int sec = (t[0] >> 4) * 10 + (t[0] & 15);
        if (sec != last) {
            last = sec;
            char a[17] = "    00:00:00    ", b[17] = "2000-00-00 Sun  ";
            two(a + 4, (t[2] >> 4 & 3) * 10 + (t[2] & 15)); two(a + 7, (t[1] >> 4) * 10 + (t[1] & 15)); two(a + 10, sec);
            two(b + 2, (t[6] >> 4) * 10 + (t[6] & 15)); two(b + 5, (t[5] >> 4 & 1) * 10 + (t[5] & 15)); two(b + 8, (t[4] >> 4) * 10 + (t[4] & 15));
            const char *d = days[t[3] & 7]; b[11] = d[0]; b[12] = d[1]; b[13] = d[2];
            lcd_at(0, 0); lcd_str(a); lcd_at(1, 0); lcd_str(b);
        }
        delay_ms(100);
    }
}
