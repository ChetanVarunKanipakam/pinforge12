#include "i2c2.h"
int main(void) {
    sys_init(); i2c_init(400000);
    uint8_t buf[72]; buf[0] = 0x00; buf[1] = 0x30;                                  /* address 0x0030, 24C256: 64-byte pages */
    for (int i = 0; i < 70; i++) buf[2 + i] = (uint8_t)(i + 1);
    int r = i2c_wr(0x50, buf, 72, 1);
    u_puts("WR="); u_dec(r);
    int polls = 0; uint32_t t0 = ms; while (i2c_wr(0x50, buf, 0, 1) != 0) { polls++; if (polls > 500000) break; }
    u_puts(" POLL_MS="); u_dec((int32_t)(ms - t0)); u_puts(" POLLS>1="); u_dec(polls > 1);
    uint8_t p[2] = { 0x00, 0x30 }, rd[70]; r = reg_rd(0x50, p, 2, rd, 70);
    u_puts(" RD="); u_dec(r); u_puts(" [0x30]="); u_dec(rd[0]); u_puts(" [0x3F]="); u_dec(rd[15]);
    uint8_t q[2] = { 0x00, 0x00 }, wr[1]; r = reg_rd(0x50, q, 2, wr, 1); u_puts(" WRAP[0]="); u_dec(wr[0]);   /* bytes 65..70 wrapped to the start of the page (0x00..0x05)? */
    uint8_t q2[2] = { 0x00, 0x40 }, v[2]; reg_rd(0x50, q2, 2, v, 1); u_puts(" [0x40]="); u_dec(v[0]);
    uint8_t cur[1]; i2c_rd(0x50, cur, 1); u_puts(" CUR="); u_dec(cur[0]);
    u_puts("\r\nDONE\r\n"); for (;;);
}
