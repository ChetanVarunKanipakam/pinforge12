#include "lpc17xx.h"
/* I2C master test against a 24Cxx-style EEPROM at 0xA0: write 2 bytes, read them back with a repeated START, address a device that is not there.
   Every status code and every byte received is recorded in res[]. BUS = 0, 1 or 2 selects I2C0 / I2C1 / I2C2 (pins as in the pin tables). */
#ifndef BUS
#define BUS 2
#endif
#if BUS == 0
#define I2C LPC_I2C0
#define PCON PCONP_PCI2C0
#define HANDLER I2C0_IRQHandler
#define IRQN I2C0_IRQn
#define PINS() (LPC_PINCON->PINSEL1 = (LPC_PINCON->PINSEL1 & ~((3u << 22) | (3u << 24))) | (1u << 22) | (1u << 24))   /* P0.27 SDA0, P0.28 SCL0 */
#elif BUS == 1
#define I2C LPC_I2C1
#define PCON PCONP_PCI2C1
#define HANDLER I2C1_IRQHandler
#define IRQN I2C1_IRQn
#define PINS() (LPC_PINCON->PINSEL0 |= 15u)                                                                         /* P0.0 SDA1, P0.1 SCL1: function 3 */
#else
#define I2C LPC_I2C2
#define PCON PCONP_PCI2C2
#define HANDLER I2C2_IRQHandler
#define IRQN I2C2_IRQn
#define PINS() (LPC_PINCON->PINSEL0 = (LPC_PINCON->PINSEL0 & ~((3u << 20) | (3u << 22))) | (2u << 20) | (2u << 22)) /* P0.10 SDA2, P0.11 SCL2: function 2 */
#endif

volatile uint32_t res[48];
volatile int n;
static void rec(uint32_t v) { if (n < 40) res[n++] = v; }
static uint32_t wait_si(void) { uint32_t g = 20000; while (!(I2C->I2CONSET & I2C_SI) && --g); return g ? I2C->I2STAT : 0xFFFF; }
static void stop(void) { I2C->I2CONSET = I2C_STO; I2C->I2CONCLR = I2C_SI; uint32_t g = 20000; while ((I2C->I2CONSET & I2C_STO) && --g); rec(I2C->I2STAT); }
static void step(uint32_t clr) { I2C->I2CONCLR = clr; rec(wait_si()); }

#ifdef IRQ
static const uint8_t payload[2] = { 0x77, 0x88 };
static volatile int idx, fin;
void HANDLER(void) {
    switch (I2C->I2STAT) {
    case 0x08: I2C->I2DAT = 0xA0; I2C->I2CONCLR = I2C_STA; break;
    case 0x18: I2C->I2DAT = 0x30; break;
    case 0x28: if (idx < 2) I2C->I2DAT = payload[idx++]; else { I2C->I2CONSET = I2C_STO; fin = 1; } break;
    default: I2C->I2CONSET = I2C_STO; fin = 2; break;
    }
    res[20 + (n < 20 ? n++ : 0)] = I2C->I2STAT;
    I2C->I2CONCLR = I2C_SI;
}
#endif

int main(void) {
#ifdef NOPOWER
    LPC_SC->PCONP &= ~PCON;                              /* the I2C blocks are powered after reset: switch this one off */
#else
    LPC_SC->PCONP |= PCON;
#endif
    PINS();
    I2C->I2SCLH = 5; I2C->I2SCLL = 5;                   /* PCLK = CCLK / 4 = 1 MHz: 1 MHz / 10 = 100 kHz */
    I2C->I2CONSET = I2C_I2EN;
#ifdef IRQ
    NVIC_EnableIRQ(IRQN);
    I2C->I2CONSET = I2C_STA;
    uint32_t g = 200000; while (!fin && --g);
    res[0] = fin; res[1] = I2C->I2STAT;
#else
    /* write 0xAB 0xCD at address 0x10 */
    I2C->I2CONSET = I2C_STA;            rec(wait_si());       /* 0x08 */
    I2C->I2DAT = 0xA0;  step(I2C_STA | I2C_SI);               /* 0x18 SLA+W acked */
    I2C->I2DAT = 0x10;  step(I2C_SI);                         /* 0x28 */
    I2C->I2DAT = 0xAB;  step(I2C_SI);                         /* 0x28 */
    I2C->I2DAT = 0xCD;  step(I2C_SI);                         /* 0x28 */
    stop();                                                   /* 0xF8 */
    /* read it back: write the address, repeated START, SLA+R, two bytes (ACK, then NACK) */
    I2C->I2CONSET = I2C_STA;            rec(wait_si());       /* 0x08 */
    I2C->I2DAT = 0xA0;  step(I2C_STA | I2C_SI);               /* 0x18 */
    I2C->I2DAT = 0x10;  step(I2C_SI);                         /* 0x28 */
    I2C->I2CONSET = I2C_STA; step(I2C_SI);                    /* 0x10 repeated START */
    I2C->I2DAT = 0xA1;  step(I2C_STA | I2C_SI);               /* 0x40 SLA+R acked */
    I2C->I2CONSET = I2C_AA; step(I2C_SI);                     /* 0x50 first byte, ACK returned */
    rec(I2C->I2DAT);
    I2C->I2CONCLR = I2C_AA; step(I2C_SI);                     /* 0x58 second byte, NACK returned */
    rec(I2C->I2DAT);
    stop();
    /* a device that is not there */
    I2C->I2CONSET = I2C_STA;            rec(wait_si());       /* 0x08 */
    I2C->I2DAT = 0xA2;  step(I2C_STA | I2C_SI);               /* 0x20 SLA+W not acked */
    stop();
#endif
    res[47] = 1;
    for (;;);
}
