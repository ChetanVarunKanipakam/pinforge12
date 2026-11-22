#include "i2c2.h"
static void p3(const char *n, int v) { u_puts(n); u_putc('='); u_dec(v); u_putc(' '); }
int main(void) {
    sys_init(); i2c_init(100000);
    int who = rd8(0x68, 0x75), pm = rd8(0x68, 0x6B);
    u_puts("WHO="); u_hex((uint32_t)who, 2); u_puts(" PM1="); u_hex((uint32_t)pm, 2); u_puts("\r\n");
    uint8_t b[14], reg = 0x3B; int r = reg_rd(0x68, &reg, 1, b, 14);
    u_puts("ASLEEP r="); u_dec(r); u_puts(" az="); u_dec((int16_t)((b[4] << 8) | b[5])); u_puts("\r\n");
    reg_wr(0x68, 0x6B, 0x00);                          /* wake up */
    reg_rd(0x68, &reg, 1, b, 14);
    u_puts("EARLY az="); u_dec((int16_t)((b[4] << 8) | b[5])); u_puts(" gx="); u_dec((int16_t)((b[8] << 8) | b[9])); u_puts("\r\n");   /* before the 20/35 ms start-up */
    delay_ms(60);
    reg_rd(0x68, &reg, 1, b, 14);
    p3("ax", (int16_t)((b[0] << 8) | b[1])); p3("ay", (int16_t)((b[2] << 8) | b[3])); p3("az", (int16_t)((b[4] << 8) | b[5]));
    p3("t", (int16_t)((b[6] << 8) | b[7])); p3("gx", (int16_t)((b[8] << 8) | b[9])); p3("gy", (int16_t)((b[10] << 8) | b[11])); p3("gz", (int16_t)((b[12] << 8) | b[13])); u_puts("\r\n");
    reg_wr(0x68, 0x1C, 0x10); reg_wr(0x68, 0x1B, 0x18);        /* accel +-8 g, gyro +-2000 dps */
    reg_rd(0x68, &reg, 1, b, 14);
    u_puts("FS8 "); p3("az", (int16_t)((b[4] << 8) | b[5])); p3("gx", (int16_t)((b[8] << 8) | b[9])); u_puts("\r\n");
    reg_wr(0x68, 0x6B, 0x80); delay_ms(5);                     /* device reset */
    u_puts("RESET PM1="); u_hex((uint32_t)rd8(0x68, 0x6B), 2); u_puts("\r\nDONE\r\n");
    for (;;);
}
