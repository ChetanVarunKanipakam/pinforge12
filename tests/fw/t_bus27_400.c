#include "i2c2.h"
/* probe one address and report the result code; used for the electrical-rule tests */
int main(void) {
    sys_init(); i2c_init(400000);
    uint8_t a = 0x27; int r = i2c_wr(a, 0, 0, 1);
    u_puts("PROBE="); u_dec(r); u_puts("\r\nDONE\r\n"); for (;;);
}
