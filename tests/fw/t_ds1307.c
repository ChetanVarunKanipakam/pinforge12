#include "i2c2.h"
int main(void) {
    sys_init(); i2c_init(400000);                                  /* too fast for a DS1307 (100 kHz max) */
    int r400 = rd8(0x68, 0x00);
    u_puts("FAST400="); u_dec(r400); u_puts("\r\n");
    i2c_init(100000);
    int s0 = rd8(0x68, 0x00); u_puts("SEC0="); u_hex((uint32_t)s0, 2); u_puts(" CH="); u_dec((s0 >> 7) & 1); u_puts("\r\n");
    uint8_t set[8] = { 0x00, 0x30, 0x15, 0x09, 0x03, 0x14, 0x08, 0x26 };         /* start the clock: 2026-08-14 09:15:30 */
    i2c_wr(0x68, set, 8, 1);
    delay_ms(2100);
    uint8_t b[7], reg = 0; reg_rd(0x68, &reg, 1, b, 7);
    u_puts("T="); u_hex(b[2], 2); u_putc(':'); u_hex(b[1], 2); u_putc(':'); u_hex(b[0], 2); u_puts(" CH="); u_dec(b[0] >> 7); u_puts("\r\n");
    uint8_t ram[4] = { 0x08, 0xA5, 0x5A, 0x77 }; i2c_wr(0x68, ram, 4, 1);
    uint8_t rr[3], rg = 0x08; reg_rd(0x68, &rg, 1, rr, 3); u_puts("RAM="); u_hex(rr[0], 2); u_hex(rr[1], 2); u_hex(rr[2], 2); u_puts("\r\nDONE\r\n");
    for (;;);
}
