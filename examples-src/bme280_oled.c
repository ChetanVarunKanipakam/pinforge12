/* Weather station: BME280 (temperature, pressure, humidity) and an SSD1306 OLED share the same I2C2 bus
   (SCL = PB10, SDA = PB11). The BME280 is read with Bosch's own integer compensation formulas from its datasheet.
   Change temperature / pressure / humidity in the BME280's inspector while it runs. */
#include <stdint.h>
#include "stm32f1.h"

static const uint8_t font5x7[95][5] = {   /* ASCII 32..126, one byte per column, bit 0 = top row */
    {0x00,0x00,0x00,0x00,0x00}, {0x00,0x00,0x5f,0x00,0x00}, {0x00,0x07,0x00,0x07,0x00}, {0x14,0x7f,0x14,0x7f,0x14},
    {0x24,0x2a,0x7f,0x2a,0x12}, {0x23,0x13,0x08,0x64,0x62}, {0x36,0x49,0x56,0x20,0x50}, {0x00,0x08,0x07,0x03,0x00},
    {0x00,0x1c,0x22,0x41,0x00}, {0x00,0x41,0x22,0x1c,0x00}, {0x2a,0x1c,0x7f,0x1c,0x2a}, {0x08,0x08,0x3e,0x08,0x08},
    {0x00,0x80,0x70,0x30,0x00}, {0x08,0x08,0x08,0x08,0x08}, {0x00,0x00,0x60,0x60,0x00}, {0x20,0x10,0x08,0x04,0x02},
    {0x3e,0x51,0x49,0x45,0x3e}, {0x00,0x42,0x7f,0x40,0x00}, {0x72,0x49,0x49,0x49,0x46}, {0x21,0x41,0x49,0x4d,0x33},
    {0x18,0x14,0x12,0x7f,0x10}, {0x27,0x45,0x45,0x45,0x39}, {0x3c,0x4a,0x49,0x49,0x31}, {0x41,0x21,0x11,0x09,0x07},
    {0x36,0x49,0x49,0x49,0x36}, {0x46,0x49,0x49,0x29,0x1e}, {0x00,0x00,0x14,0x00,0x00}, {0x00,0x40,0x34,0x00,0x00},
    {0x00,0x08,0x14,0x22,0x41}, {0x14,0x14,0x14,0x14,0x14}, {0x00,0x41,0x22,0x14,0x08}, {0x02,0x01,0x59,0x09,0x06},
    {0x3e,0x41,0x5d,0x59,0x4e}, {0x7c,0x12,0x11,0x12,0x7c}, {0x7f,0x49,0x49,0x49,0x36}, {0x3e,0x41,0x41,0x41,0x22},
    {0x7f,0x41,0x41,0x41,0x3e}, {0x7f,0x49,0x49,0x49,0x41}, {0x7f,0x09,0x09,0x09,0x01}, {0x3e,0x41,0x41,0x51,0x73},
    {0x7f,0x08,0x08,0x08,0x7f}, {0x00,0x41,0x7f,0x41,0x00}, {0x20,0x40,0x41,0x3f,0x01}, {0x7f,0x08,0x14,0x22,0x41},
    {0x7f,0x40,0x40,0x40,0x40}, {0x7f,0x02,0x1c,0x02,0x7f}, {0x7f,0x04,0x08,0x10,0x7f}, {0x3e,0x41,0x41,0x41,0x3e},
    {0x7f,0x09,0x09,0x09,0x06}, {0x3e,0x41,0x51,0x21,0x5e}, {0x7f,0x09,0x19,0x29,0x46}, {0x26,0x49,0x49,0x49,0x32},
    {0x03,0x01,0x7f,0x01,0x03}, {0x3f,0x40,0x40,0x40,0x3f}, {0x1f,0x20,0x40,0x20,0x1f}, {0x3f,0x40,0x38,0x40,0x3f},
    {0x63,0x14,0x08,0x14,0x63}, {0x03,0x04,0x78,0x04,0x03}, {0x61,0x59,0x49,0x4d,0x43}, {0x00,0x7f,0x41,0x41,0x41},
    {0x02,0x04,0x08,0x10,0x20}, {0x00,0x41,0x41,0x7f,0x00}, {0x04,0x02,0x01,0x02,0x04}, {0x40,0x40,0x40,0x40,0x40},
    {0x00,0x03,0x07,0x08,0x00}, {0x20,0x54,0x54,0x78,0x40}, {0x7f,0x28,0x44,0x44,0x38}, {0x38,0x44,0x44,0x44,0x28},
    {0x38,0x44,0x44,0x28,0x7f}, {0x38,0x54,0x54,0x54,0x18}, {0x00,0x08,0x7e,0x09,0x02}, {0x18,0xa4,0xa4,0x9c,0x78},
    {0x7f,0x08,0x04,0x04,0x78}, {0x00,0x44,0x7d,0x40,0x00}, {0x20,0x40,0x40,0x3d,0x00}, {0x7f,0x10,0x28,0x44,0x00},
    {0x00,0x41,0x7f,0x40,0x00}, {0x7c,0x04,0x78,0x04,0x78}, {0x7c,0x08,0x04,0x04,0x78}, {0x38,0x44,0x44,0x44,0x38},
    {0xfc,0x18,0x24,0x24,0x18}, {0x18,0x24,0x24,0x18,0xfc}, {0x7c,0x08,0x04,0x04,0x08}, {0x48,0x54,0x54,0x54,0x24},
    {0x04,0x04,0x3f,0x44,0x24}, {0x3c,0x40,0x40,0x20,0x7c}, {0x1c,0x20,0x40,0x20,0x1c}, {0x3c,0x40,0x30,0x40,0x3c},
    {0x44,0x28,0x10,0x28,0x44}, {0x4c,0x90,0x90,0x90,0x7c}, {0x44,0x64,0x54,0x4c,0x44}, {0x00,0x08,0x36,0x41,0x00},
    {0x00,0x00,0x77,0x00,0x00}, {0x00,0x41,0x36,0x08,0x00}, {0x02,0x01,0x02,0x04,0x02},
};
static volatile uint32_t ms; void SysTick_Handler(void) { ms++; }
static void delay_ms(uint32_t d) { uint32_t t = ms + d; while ((int32_t)(ms - t) < 0) { } }
static void uart_init(void) { RCC->APB2ENR |= RCC_APB2ENR_IOPAEN | RCC_APB2ENR_USART1EN; gpio_cfg(GPIOA, 9, GPIO_AF_PP_2MHZ); USART1->BRR = 8000000 / 115200; USART1->CR1 = (1u << 13) | (1u << 3); SysTick->LOAD = 8000 - 1; SysTick->CTRL = 7; }
static void putc_(char c) { while (!(USART1->SR & 0x80)); USART1->DR = (uint32_t)c; }
static void puts_(const char *s) { while (*s) putc_(*s++); }

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
static int write_reg(uint8_t a7, uint8_t reg, uint8_t v) { uint8_t b[2] = { reg, v }; return i2c_write(a7, b, 2, 1); }

#define OLED 0x3C
#define BME  0x76
static uint16_t T1, P1; static int16_t T2, T3, P2, P3, P4, P5, P6, P7, P8, P9, H2, H4, H5; static uint8_t H1, H3; static int8_t H6; static int32_t t_fine;
static int32_t comp_T(int32_t a) { int32_t v1 = ((((a >> 3) - ((int32_t)T1 << 1))) * ((int32_t)T2)) >> 11; int32_t v2 = (((((a >> 4) - ((int32_t)T1)) * ((a >> 4) - ((int32_t)T1))) >> 12) * ((int32_t)T3)) >> 14; t_fine = v1 + v2; return (t_fine * 5 + 128) >> 8; }
static uint32_t comp_P(int32_t a) {                       /* Pa x 256 */
    int64_t v1 = ((int64_t)t_fine) - 128000, v2 = v1 * v1 * (int64_t)P6; v2 += ((v1 * (int64_t)P5) << 17); v2 += (((int64_t)P4) << 35);
    v1 = ((v1 * v1 * (int64_t)P3) >> 8) + ((v1 * (int64_t)P2) << 12); v1 = (((((int64_t)1) << 47) + v1)) * ((int64_t)P1) >> 33; if (!v1) return 0;
    int64_t p = 1048576 - a; p = (((p << 31) - v2) * 3125) / v1; v1 = (((int64_t)P9) * (p >> 13) * (p >> 13)) >> 25; v2 = (((int64_t)P8) * p) >> 19; return (uint32_t)(((p + v1 + v2) >> 8) + (((int64_t)P7) << 4));
}
static uint32_t comp_H(int32_t a) {                       /* %RH x 1024 */
    int32_t v = (t_fine - 76800);
    v = (((((a << 14) - (((int32_t)H4) << 20) - (((int32_t)H5) * v)) + 16384) >> 15) * (((((((v * ((int32_t)H6)) >> 10) * (((v * ((int32_t)H3)) >> 11) + 32768)) >> 10) + 2097152) * ((int32_t)H2) + 8192) >> 14));
    v = (v - (((((v >> 15) * (v >> 15)) >> 7) * ((int32_t)H1)) >> 4)); v = (v < 0 ? 0 : v); v = (v > 419430400 ? 419430400 : v); return (uint32_t)(v >> 12);
}
static void oled_send(uint8_t ctl, const uint8_t *d, int n) { uint8_t b[130]; b[0] = ctl; for (int i = 0; i < n; i++) b[1 + i] = d[i]; i2c_write(OLED, b, n + 1, 1); }
static void oled_init(void) {
    static const uint8_t init[] = { 0xAE, 0xD5, 0x80, 0xA8, 0x3F, 0xD3, 0x00, 0x40, 0x8D, 0x14, 0x20, 0x02, 0xA1, 0xC8, 0xDA, 0x12, 0x81, 0xCF, 0xD9, 0xF1, 0xDB, 0x40, 0xA4, 0xA6, 0xAF };
    oled_send(0x00, init, sizeof init);
}
static void oled_text(int page, const char *s) {
    uint8_t buf[128] = { 0 }; int n = 0; uint8_t pos[3] = { (uint8_t)(0xB0 | page), 0x00, 0x10 };
    for (; *s && n + 6 <= 128; s++) { const uint8_t *g = font5x7[(*s - 32) % 95]; for (int i = 0; i < 5; i++) buf[n++] = g[i]; buf[n++] = 0; }
    oled_send(0x00, pos, 3); oled_send(0x40, buf, 128);
}
static void fmt(char *o, const char *label, int32_t v, int dec, const char *unit) {    /* "T:   25.00 C" */
    int n = 0, k = 0, m = 0, neg = v < 0;
    char t[14], d[12];
    while (*label) { o[n++] = *label++; }
    uint32_t u = (uint32_t)(neg ? -v : v), p = 1;
    for (int i = 0; i < dec; i++) p *= 10;
    uint32_t ip = u / p, fp = u % p;
    do { d[m++] = (char)('0' + ip % 10); ip /= 10; } while (ip);
    if (neg) { t[k++] = '-'; }
    while (m) { t[k++] = d[--m]; }
    if (dec) {
        t[k++] = '.';
        for (int i = dec - 1; i >= 0; i--) { uint32_t q = 1; for (int j = 0; j < i; j++) q *= 10; t[k++] = (char)('0' + (fp / q) % 10); }
    }
    for (int i = k; i < 8; i++) { o[n++] = ' '; }
    for (int i = 0; i < k; i++) { o[n++] = t[i]; }
    o[n++] = ' ';
    while (*unit) { o[n++] = *unit++; }
    o[n] = 0;
}
int main(void) {
    uart_init(); i2c_init(); oled_init();
    oled_text(0, "BME280 weather");
    uint8_t id = 0;
    if (read_regs(BME, 0xD0, &id, 1)) {
        oled_text(2, "BME280 not found"); puts_("BME280 not found\r\n");
        for (;;) { }
    }
    int bme = (id == 0x60); puts_(bme ? "BME280\r\n" : "BMP280 (no humidity)\r\n");
    uint8_t c[24]; read_regs(BME, 0x88, c, 24);
    T1 = (uint16_t)(c[0] | c[1] << 8); T2 = (int16_t)(c[2] | c[3] << 8); T3 = (int16_t)(c[4] | c[5] << 8); P1 = (uint16_t)(c[6] | c[7] << 8);
    P2 = (int16_t)(c[8] | c[9] << 8); P3 = (int16_t)(c[10] | c[11] << 8); P4 = (int16_t)(c[12] | c[13] << 8); P5 = (int16_t)(c[14] | c[15] << 8);
    P6 = (int16_t)(c[16] | c[17] << 8); P7 = (int16_t)(c[18] | c[19] << 8); P8 = (int16_t)(c[20] | c[21] << 8); P9 = (int16_t)(c[22] | c[23] << 8);
    if (bme) { uint8_t h[7]; read_regs(BME, 0xA1, h, 1); H1 = h[0]; read_regs(BME, 0xE1, h, 7);
        H2 = (int16_t)(h[0] | h[1] << 8); H3 = h[2]; H4 = (int16_t)(((int8_t)h[3] * 16) | (h[4] & 0x0F)); H5 = (int16_t)(((int8_t)h[5] * 16) | (h[4] >> 4)); H6 = (int8_t)h[6]; }
    for (;;) {
        if (bme) write_reg(BME, 0xF2, 0x01);                  /* humidity x1 */
        write_reg(BME, 0xF4, 0x25);                           /* temperature x1, pressure x1, forced mode: one measurement */
        uint8_t st = 8; for (int n = 0; n < 200 && (st & 8); n++) { delay_ms(2); read_regs(BME, 0xF3, &st, 1); }
        uint8_t d[8]; read_regs(BME, 0xF7, d, bme ? 8 : 6);
        int32_t T = comp_T((d[3] << 12) | (d[4] << 4) | (d[5] >> 4)); uint32_t P = comp_P((d[0] << 12) | (d[1] << 4) | (d[2] >> 4));
        char line[24];
        fmt(line, "T:", T, 2, "C"); oled_text(2, line); puts_(line); puts_("   ");
        fmt(line, "P:", (int32_t)((P >> 8) / 10), 1, "hPa"); oled_text(4, line); puts_(line); puts_("   ");
        if (bme) { fmt(line, "H:", (int32_t)((comp_H((d[6] << 8) | d[7]) * 10) >> 10), 1, "%"); oled_text(6, line); puts_(line); }
        puts_("\r\n"); delay_ms(1000);
    }
}
