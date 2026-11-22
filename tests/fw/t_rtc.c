#include "i2c2.h"
static void show(const char *tag, const uint8_t *b) { u_puts(tag); u_hex(b[6], 2); u_putc('-'); u_hex(b[5] & 0x1F, 2); u_putc('-'); u_hex(b[4], 2); u_putc(' '); u_hex(b[2], 2); u_putc(':'); u_hex(b[1], 2); u_putc(':'); u_hex(b[0], 2); u_puts(" dow="); u_hex(b[3], 1); u_puts("\r\n"); }
int main(void) {
    sys_init(); i2c_init(100000);
    uint8_t b[19], reg = 0;
    u_puts("RTC="); u_dec(rd8(0x68, 0x0F) >= 0); u_puts(" EE="); u_dec(rd8(0x57, 0x00) >= 0); u_puts("\r\n");
    reg_rd(0x68, &reg, 1, b, 7); show("NOW ", b);
    uint8_t set[8] = { 0, 0x58, 0x59, 0x23, 0x04, 0x31, 0x12, 0x30 };        /* 2030-12-31 23:59:58, Tuesday=3? (day register written as 4) */
    i2c_wr(0x68, set, 8, 1);
    reg_rd(0x68, &reg, 1, b, 7); show("SET ", b);
    delay_ms(3000);
    reg_rd(0x68, &reg, 1, b, 7); show("AFTER3S ", b);
    /* alarm 1 at 00:00:05 (seconds, minutes, hours match; date ignored), enable interrupt output */
    uint8_t al[5] = { 0x07, 0x03, 0x00, 0x00, 0x80 }; i2c_wr(0x68, al, 5, 1);
    reg_wr(0x68, 0x0F, 0x00); reg_wr(0x68, 0x0E, 0x05);                          /* INTCN=1, A1IE=1 */
    u_puts("STATUS0="); u_hex((uint32_t)rd8(0x68, 0x0F), 2); u_puts(" SQW="); u_dec((GPIOB->IDR >> 1) & 1); u_puts("\r\n");
    delay_ms(2500);
    u_puts("STATUS1="); u_hex((uint32_t)rd8(0x68, 0x0F), 2); u_puts(" SQW="); u_dec((GPIOB->IDR >> 1) & 1); u_puts("\r\n");
    reg_wr(0x68, 0x0F, 0x00);
    u_puts("STATUS2="); u_hex((uint32_t)rd8(0x68, 0x0F), 2); u_puts(" SQW="); u_dec((GPIOB->IDR >> 1) & 1); u_puts("\r\n");
    reg = 0x11; reg_rd(0x68, &reg, 1, b, 2); u_puts("TEMP="); u_dec((int8_t)b[0]); u_putc('.'); u_dec((b[1] >> 6) * 25); u_puts("\r\n");
    /* the EEPROM on the module */
    uint8_t w[6] = { 0x01, 0x00, 'D', 'S', '3', '2' }; int r = i2c_wr(0x57, w, 6, 1);
    int polls = 0; while (i2c_wr(0x57, w, 0, 1) != 0 && polls < 100) { polls++; delay_ms(1); }
    uint8_t p[2] = { 0x01, 0x00 }, rd[4]; reg_rd(0x57, p, 2, rd, 4);
    u_puts("EE wr="); u_dec(r); u_puts(" polls>0="); u_dec(polls > 0); u_puts(" read="); for (int i = 0; i < 4; i++) u_putc((char)rd[i]); u_puts("\r\nDONE\r\n");
    for (;;);
}
