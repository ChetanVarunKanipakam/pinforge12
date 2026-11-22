/* MPU-6050 accelerometer + gyroscope + thermometer on I2C2 (SCL = PB10, SDA = PB11, address 0x68 with AD0 open).
   Prints a reading twice a second on the Serial Monitor (USART1, PA9, 115200 baud).
   While it runs, change the accel / gyro / temperature values in the sensor's inspector panel.
   The chip powers up asleep (PWR_MGMT_1 = 0x40): it must be woken before the data registers update. */
#include <stdint.h>
#include "stm32f1.h"

static volatile uint32_t ms; void SysTick_Handler(void) { ms++; }
static void delay_ms(uint32_t d) { uint32_t t = ms + d; while ((int32_t)(ms - t) < 0) { } }
static void uart_init(void) { RCC->APB2ENR |= RCC_APB2ENR_IOPAEN | RCC_APB2ENR_USART1EN; gpio_cfg(GPIOA, 9, GPIO_AF_PP_2MHZ); USART1->BRR = 8000000 / 115200; USART1->CR1 = (1u << 13) | (1u << 3); SysTick->LOAD = 8000 - 1; SysTick->CTRL = 7; }
static void putc_(char c) { while (!(USART1->SR & 0x80)); USART1->DR = (uint32_t)c; }
static void puts_(const char *s) { while (*s) putc_(*s++); }
static void put_fixed(int32_t v, int dec, int width) {      /* v has `dec` implied decimals; right-aligned in `width` characters */
    char b[16], t[12];
    int n = 0, k = 0, neg = v < 0;
    uint32_t u = (uint32_t)(neg ? -v : v), p = 1;
    for (int i = 0; i < dec; i++) p *= 10;
    uint32_t ip = u / p, fp = u % p;
    do { t[k++] = (char)('0' + ip % 10); ip /= 10; } while (ip);
    if (neg) { b[n++] = '-'; }
    while (k) { b[n++] = t[--k]; }
    if (dec) {
        b[n++] = '.';
        for (int i = dec - 1; i >= 0; i--) { uint32_t q = 1; for (int j = 0; j < i; j++) q *= 10; b[n++] = (char)('0' + (fp / q) % 10); }
    }
    for (int i = n; i < width; i++) { putc_(' '); }
    for (int i = 0; i < n; i++) { putc_(b[i]); }
}

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

#define MPU 0x68
int main(void) {
    uart_init(); i2c_init();
    puts_("MPU-6050\r\n");
    uint8_t id = 0;
    if (read_regs(MPU, 0x75, &id, 1) || id != 0x68) { puts_("sensor not found (check wiring, address and supply)\r\n"); for (;;) { } }
    write_reg(MPU, 0x6B, 0x00);                         /* wake up: clear SLEEP */
    write_reg(MPU, 0x1C, 0x00);                         /* accel +-2 g  (16384 LSB per g) */
    write_reg(MPU, 0x1B, 0x00);                         /* gyro +-250 dps (131 LSB per dps) */
    delay_ms(100);                                      /* accel needs 20 ms, gyro 35 ms to start */
    for (;;) {
        uint8_t b[14];
        if (read_regs(MPU, 0x3B, b, 14)) {
            puts_("read failed\r\n"); delay_ms(500); continue;
        }
        int16_t ax = (int16_t)((b[0] << 8) | b[1]), ay = (int16_t)((b[2] << 8) | b[3]), az = (int16_t)((b[4] << 8) | b[5]);
        int16_t t = (int16_t)((b[6] << 8) | b[7]), gx = (int16_t)((b[8] << 8) | b[9]), gy = (int16_t)((b[10] << 8) | b[11]), gz = (int16_t)((b[12] << 8) | b[13]);
        puts_("accel g: "); put_fixed(ax * 1000 / 16384, 3, 7); put_fixed(ay * 1000 / 16384, 3, 7); put_fixed(az * 1000 / 16384, 3, 7);
        puts_("   temp C: "); put_fixed(t * 100 / 340 + 3653, 2, 6);
        puts_("   gyro dps: "); put_fixed(gx * 10 / 131, 1, 7); put_fixed(gy * 10 / 131, 1, 7); put_fixed(gz * 10 / 131, 1, 7); puts_("\r\n");
        delay_ms(500);
    }
}
