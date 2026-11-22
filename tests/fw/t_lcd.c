#include "i2c2.h"
#define A 0x27
static int rc;
static void pcf(uint8_t v) { rc |= i2c_wr(A, &v, 1, 1); }
static void nib(uint8_t n, uint8_t rs) { uint8_t b = (uint8_t)((n << 4) | 0x08 | rs); pcf(b | 4); pcf(b); }        /* backlight on, E pulse */
static void lcd_byte(uint8_t v, uint8_t rs) { nib(v >> 4, rs); nib(v & 15, rs); }
int main(void) {
    sys_init(); i2c_init(100000);
    delay_ms(50); nib(3, 0); delay_ms(5); nib(3, 0); delay_ms(1); nib(3, 0); nib(2, 0);       /* HD44780 4-bit initialisation */
    lcd_byte(0x28, 0); lcd_byte(0x0C, 0); lcd_byte(0x06, 0); lcd_byte(0x01, 0); delay_ms(3);
    const char *s = "I2C LCD works"; while (*s) lcd_byte((uint8_t)*s++, 1);
    lcd_byte(0xC0, 0); s = "Line 2"; while (*s) lcd_byte((uint8_t)*s++, 1);
    u_puts("RC="); u_dec(rc); u_puts("\r\nDONE\r\n"); for (;;);
}
