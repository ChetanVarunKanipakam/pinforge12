#include "i2c2.h"
static int rd16(uint8_t a) { uint8_t b[2]; int r = i2c_rd(a, b, 2); return r ? -r : (b[0] << 8 | b[1]); }
int main(void) {
    sys_init(); i2c_init(100000);
    uint8_t a = 0x23, c;
    c = 0x01; u_puts("PWRON="); u_dec(i2c_wr(a, &c, 1, 1));
    c = 0x20; u_puts(" ONCE="); u_dec(i2c_wr(a, &c, 1, 1));                   /* one-time H-resolution */
    delay_ms(10); u_puts(" EARLY="); u_dec(rd16(a));
    delay_ms(200); int raw = rd16(a); u_puts(" RAW="); u_dec(raw); u_puts(" LUX10="); u_dec(raw * 10 / 12);
    c = 0x10; i2c_wr(a, &c, 1, 1); delay_ms(200); u_puts(" CONT="); u_dec(rd16(a));
    c = 0x42; i2c_wr(a, &c, 1, 1); c = 0x65; i2c_wr(a, &c, 1, 1);               /* MTreg 0x42 high bits 010, low bits 00101 => 69 stays; use 138: 100 01010 */
    c = 0x44; i2c_wr(a, &c, 1, 1); c = 0x6A; i2c_wr(a, &c, 1, 1); c = 0x10; i2c_wr(a, &c, 1, 1); delay_ms(400); u_puts(" MT138="); u_dec(rd16(a));
    u_puts("\r\nDONE\r\n"); for (;;);
}
