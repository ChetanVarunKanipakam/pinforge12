#include "i2c2.h"
static uint16_t T1, P1; static int16_t T2, T3, P2, P3, P4, P5, P6, P7, P8, P9, H2, H4, H5; static uint8_t H1, H3; static int8_t H6; static int32_t t_fine;
static int32_t comp_T(int32_t a) { int32_t v1 = ((((a >> 3) - ((int32_t)T1 << 1))) * ((int32_t)T2)) >> 11; int32_t v2 = (((((a >> 4) - ((int32_t)T1)) * ((a >> 4) - ((int32_t)T1))) >> 12) * ((int32_t)T3)) >> 14; t_fine = v1 + v2; return (t_fine * 5 + 128) >> 8; }
static uint32_t comp_P(int32_t a) {
    int64_t v1 = ((int64_t)t_fine) - 128000, v2 = v1 * v1 * (int64_t)P6; v2 = v2 + ((v1 * (int64_t)P5) << 17); v2 = v2 + (((int64_t)P4) << 35);
    v1 = ((v1 * v1 * (int64_t)P3) >> 8) + ((v1 * (int64_t)P2) << 12); v1 = (((((int64_t)1) << 47) + v1)) * ((int64_t)P1) >> 33; if (v1 == 0) return 0;
    int64_t p = 1048576 - a; p = (((p << 31) - v2) * 3125) / v1; v1 = (((int64_t)P9) * (p >> 13) * (p >> 13)) >> 25; v2 = (((int64_t)P8) * p) >> 19; p = ((p + v1 + v2) >> 8) + (((int64_t)P7) << 4); return (uint32_t)p;
}
static uint32_t comp_H(int32_t a) {
    int32_t v = (t_fine - 76800);
    v = (((((a << 14) - (((int32_t)H4) << 20) - (((int32_t)H5) * v)) + 16384) >> 15) * (((((((v * ((int32_t)H6)) >> 10) * (((v * ((int32_t)H3)) >> 11) + 32768)) >> 10) + 2097152) * ((int32_t)H2) + 8192) >> 14));
    v = (v - (((((v >> 15) * (v >> 15)) >> 7) * ((int32_t)H1)) >> 4)); v = (v < 0 ? 0 : v); v = (v > 419430400 ? 419430400 : v); return (uint32_t)(v >> 12);
}
int main(void) {
    sys_init(); i2c_init(400000);
    uint8_t a = 0x76; int id = rd8(a, 0xD0);
    if (id < 0) { a = 0x77; id = rd8(a, 0xD0); }
    u_puts("ADDR="); u_hex(a, 2); u_puts(" ID="); u_hex((uint32_t)id, 2); u_puts(" STATUS_EARLY="); u_hex((uint32_t)rd8(a, 0xF3), 2); u_puts("\r\n");
    uint8_t c[26], reg = 0x88; reg_rd(a, &reg, 1, c, 24);
    T1 = (uint16_t)(c[0] | c[1] << 8); T2 = (int16_t)(c[2] | c[3] << 8); T3 = (int16_t)(c[4] | c[5] << 8); P1 = (uint16_t)(c[6] | c[7] << 8);
    P2 = (int16_t)(c[8] | c[9] << 8); P3 = (int16_t)(c[10] | c[11] << 8); P4 = (int16_t)(c[12] | c[13] << 8); P5 = (int16_t)(c[14] | c[15] << 8);
    P6 = (int16_t)(c[16] | c[17] << 8); P7 = (int16_t)(c[18] | c[19] << 8); P8 = (int16_t)(c[20] | c[21] << 8); P9 = (int16_t)(c[22] | c[23] << 8);
    int bme = (id == 0x60);
    if (bme) { uint8_t h[8]; reg = 0xA1; reg_rd(a, &reg, 1, h, 1); H1 = h[0]; reg = 0xE1; reg_rd(a, &reg, 1, h, 7);
        H2 = (int16_t)(h[0] | h[1] << 8); H3 = h[2]; H4 = (int16_t)(((int8_t)h[3] * 16) | (h[4] & 0x0F)); H5 = (int16_t)(((int8_t)h[5] * 16) | (h[4] >> 4)); H6 = (int8_t)h[6]; }
    /* data before the first measurement: skipped value 0x80000 */
    uint8_t d[8]; reg = 0xF7; reg_rd(a, &reg, 1, d, 8);
    u_puts("RAW0="); u_hex((uint32_t)(d[0] << 16 | d[1] << 8 | d[2]), 6); u_putc(' '); u_hex((uint32_t)(d[3] << 16 | d[4] << 8 | d[5]), 6); u_puts("\r\n");
    if (bme) reg_wr(a, 0xF2, 0x01);                       /* humidity x1 */
    reg_wr(a, 0xF4, 0x25);                                /* temp x1, pressure x1, forced mode */
    int polls = 0; while ((rd8(a, 0xF3) & 0x08) && polls < 2000) polls++;   /* wait until the measurement is done */
    u_puts("MEAS polls>0="); u_dec(polls > 0); u_puts(" mode_after="); u_hex((uint32_t)(rd8(a, 0xF4) & 3), 1); u_puts("\r\n");
    reg_rd(a, &reg, 1, d, bme ? 8 : 6); (void)reg;
    reg = 0xF7; reg_rd(a, &reg, 1, d, 8);
    int32_t rt = (d[3] << 12) | (d[4] << 4) | (d[5] >> 4), rp = (d[0] << 12) | (d[1] << 4) | (d[2] >> 4);
    int32_t T = comp_T(rt); uint32_t P = comp_P(rp) / 256;
    u_puts("T100="); u_dec(T); u_puts(" P="); u_dec((int32_t)P);
    if (bme) { int32_t rh = (d[6] << 8) | d[7]; u_puts(" H10="); u_dec((int32_t)((comp_H(rh) * 10) >> 10)); }
    u_puts("\r\n");
    u_puts("DONE\r\n");
    for (;;);
}
