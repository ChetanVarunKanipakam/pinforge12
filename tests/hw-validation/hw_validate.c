/* PinForge <-> real LPC1768 validation firmware.
   Prints one line per measurement on UART0 (P0.2 TXD0 / P0.3 RXD0) at 9600 8N1 and ends with "END".
   Run the SAME .bin on the board and in the PinForge simulator, then diff the two outputs (see README.md).
   Everything runs from the internal 4 MHz RC oscillator, so it is safe on any board (no crystal or flash-timing assumptions).
   Timings are in CPU clock cycles measured with SysTick, so they are independent of the exact RC frequency. */
#include "lpc17xx.h"

/* a free header pin that is left unconnected for test G1 (change if yours is wired to something on the board) */
#define VP_PORT 2
#define VP_PIN  7

static LPC_GPIO_TypeDef *const GP[5] = { LPC_GPIO0, LPC_GPIO1, LPC_GPIO2, LPC_GPIO3, LPC_GPIO4 };
static volatile uint32_t *const PM = &LPC_PINCON->PINMODE0;

static void putc_(char c) { while (!(LPC_UART0->LSR & LSR_THRE)); LPC_UART0->THR = c; }
static void puts_(const char *s) { while (*s) putc_(*s++); }
static void hex_(uint32_t v) { puts_("0x"); for (int i = 28; i >= 0; i -= 4) putc_("0123456789ABCDEF"[(v >> i) & 15]); }
static void dec_(uint32_t v) { char b[11]; int n = 0; do { b[n++] = '0' + v % 10; v /= 10; } while (v); while (n) putc_(b[--n]); }
static void lh(const char *id, const char *name, uint32_t v) { puts_(id); putc_(' '); puts_(name); puts_(" = "); hex_(v); puts_("\r\n"); }
static void ld(const char *id, const char *name, uint32_t v) { puts_(id); putc_(' '); puts_(name); puts_(" = "); dec_(v); puts_("\r\n"); }

static inline uint32_t cyc(void) { return SysTick->VAL; }
static inline uint32_t elapsed(uint32_t t0) { return (t0 - SysTick->VAL) & 0xFFFFFF; }
static void feed(void) { LPC_SC->PLL0FEED = 0xAA; LPC_SC->PLL0FEED = 0x55; }

#define GUARD 4000000u   /* every wait loop is bounded so that a disagreement shows up as a printed line instead of a hang */

/* time of 8 consecutive Timer0 MR0 match periods in CPU cycles (0 = the flag never came) */
static uint32_t timer_period8(uint32_t pr, uint32_t mr0) {
  LPC_TIM0->TCR = 2; LPC_TIM0->TCR = 0; LPC_TIM0->PR = pr; LPC_TIM0->MR0 = mr0; LPC_TIM0->MCR = 3;   /* reset + set the IR flag on MR0 (NVIC stays disabled, so no interrupt is taken) */
  LPC_TIM0->IR = 0xFF; LPC_TIM0->TCR = 1;
  uint32_t g = GUARD;
  while (!(LPC_TIM0->IR & 1) && --g) { }
  LPC_TIM0->IR = 1;
  uint32_t t0 = cyc();
  for (int i = 0; i < 8 && g; i++) {
    g = GUARD;
    while (!(LPC_TIM0->IR & 1) && --g) { }
    LPC_TIM0->IR = 1;
  }
  uint32_t e = g ? elapsed(t0) : 0;
  LPC_TIM0->TCR = 0;
  return e;
}

int main(void) {
  /* ---- snapshot of registers exactly as the boot ROM leaves them (before we touch anything) ---- */
  uint32_t s_pconp = LPC_SC->PCONP, s_flash = LPC_SC->FLASHCFG, s_pll = LPC_SC->PLL0STAT, s_scs = LPC_SC->SCS, s_src = LPC_SC->CLKSRCSEL,
           s_cclk = LPC_SC->CCLKCFG, s_p0 = LPC_SC->PCLKSEL0, s_p1 = LPC_SC->PCLKSEL1, s_rsid = LPC_SC->RSID,
           s_pinsel0 = LPC_PINCON->PINSEL0, s_pinmode0 = LPC_PINCON->PINMODE0, s_fio0dir = LPC_GPIO0->FIODIR;
  SysTick->LOAD = 0xFFFFFF; SysTick->CTRL = 5;                                  /* free running, CCLK */

  /* ---- UART0 9600 8N1: PCLK = CCLK/4 = 1 MHz;  1e6 / (16 * 6 * (1 + 1/12)) = 9615 baud ---- */
  LPC_PINCON->PINSEL0 = (LPC_PINCON->PINSEL0 & ~((3u << 4) | (3u << 6))) | (1u << 4) | (1u << 6);
  LPC_UART0->LCR = LCR_DLAB | 3; LPC_UART0->DLL = 6; LPC_UART0->DLM = 0; LPC_UART0->FDR = (12u << 4) | 1; LPC_UART0->LCR = 3; LPC_UART0->FCR = 7;
  puts_("\r\nPINFORGE-LPC1768-VALIDATION 1\r\n");

  lh("R1", "PCONP at entry", s_pconp);      lh("R2", "FLASHCFG at entry", s_flash);  lh("R3", "PLL0STAT at entry", s_pll);
  lh("R4", "SCS at entry", s_scs);          lh("R5", "CLKSRCSEL at entry", s_src);   lh("R6", "CCLKCFG at entry", s_cclk);
  lh("R7", "PCLKSEL0 at entry", s_p0);      lh("R8", "PCLKSEL1 at entry", s_p1);     lh("R9", "RSID at entry", s_rsid);
  lh("R10", "PINSEL0 at entry", s_pinsel0); lh("R11", "PINMODE0 at entry", s_pinmode0); lh("R12", "FIO0DIR at entry", s_fio0dir);
  lh("R13", "CPUID", *(volatile uint32_t *)0xE000ED00);
  NVIC_SetPriority(TIMER0_IRQn, 31); lh("R14", "NVIC priority readback of 31<<3", *(volatile uint8_t *)(0xE000E401));
  lh("U1", "UART0 FDR", LPC_UART0->FDR); lh("U2", "UART0 TER", LPC_UART0->TER); lh("U3", "UART0 IIR", LPC_UART0->IIR);

  /* ---- timers: how long is the period in CPU cycles? ---- */
  ld("T1", "Timer0 PCLK=CCLK/4 PR=0 MR0=999, 8 periods [cycles]", timer_period8(0, 999));
  ld("T2", "Timer0 PCLK=CCLK/4 PR=3 MR0=999, 8 periods [cycles]", timer_period8(3, 999));
  ld("T3", "Timer0 PCLK=CCLK/4 PR=0 MR0=0, 8 flags [cycles]", timer_period8(0, 0));
  LPC_SC->PCLKSEL0 = (LPC_SC->PCLKSEL0 & ~(3u << 2)) | (1u << 2);
  ld("T4", "Timer0 PCLK=CCLK PR=0 MR0=999, 8 periods [cycles]", timer_period8(0, 999));
  LPC_SC->PCLKSEL0 &= ~(3u << 2);
  { LPC_TIM0->MCR = 0; LPC_TIM0->TCR = 2; LPC_TIM0->TCR = 1; uint32_t t0 = cyc(); while (elapsed(t0) < 4000); LPC_TIM0->TCR = 0;
    ld("T5", "Timer0 TC after 4000 cycles (PR=0, PCLK=CCLK/4)", LPC_TIM0->TC); }

  /* ---- PLL0 from the internal RC: Fcco = 2 * 35 * 4 MHz / 1 = 280 MHz.  CCLKCFG = 3 gives 1 MHz while PLL0 is not connected and 70 MHz once it is
          (inside the reset FLASHCFG limit of 80 MHz). UART output would be garbled at the changed clock, so values are only collected here and printed afterwards. ---- */
  uint32_t p1, p2, p3, p4, p5, p6, p7, p8;
  LPC_SC->CLKSRCSEL = 0; LPC_SC->PLL0CFG = 34; feed();
  { LPC_SC->PLL0CON = 1; uint32_t t0 = cyc(); feed(); p1 = LPC_SC->PLL0STAT;
    uint32_t g = GUARD; while (!(LPC_SC->PLL0STAT & PLL0STAT_PLOCK) && --g) { }
    p2 = g ? elapsed(t0) : 0xFFFFFFFF; p3 = LPC_SC->PLL0STAT; }
  LPC_SC->CCLKCFG = 3; LPC_SC->PLL0CON = 3; feed(); p4 = LPC_SC->PLL0STAT;         /* now running at 70 MHz */
  LPC_SC->PLL0CON = 1; feed(); p5 = LPC_SC->PLL0STAT;                              /* disconnect: back to 1 MHz */
  LPC_SC->PLL0CON = 0; feed(); p6 = LPC_SC->PLL0STAT;
  LPC_SC->PLL0CFG = 34; feed();                                                    /* connect requested in the same feed as enable (before lock) */
  LPC_SC->PLL0CON = 3; feed(); p7 = LPC_SC->PLL0STAT;
  { uint32_t t0 = cyc(); while (elapsed(t0) < 20000) { } }
  p8 = LPC_SC->PLL0STAT;
  LPC_SC->PLL0CON = 0; feed(); LPC_SC->CCLKCFG = 0;
  lh("P1", "PLL0STAT right after enabling", p1); ld("P2", "PLL0 lock time [CPU cycles at 4 MHz]", p2); lh("P3", "PLL0STAT locked", p3);
  lh("P4", "PLL0STAT after connect", p4); lh("P5", "PLL0STAT after disconnect", p5); lh("P6", "PLL0STAT after disable", p6);
  lh("P7", "PLL0STAT right after enable+connect in one feed", p7); lh("P8", "PLL0STAT 20000 cycles later", p8);

  /* ---- GPIO input levels of a floating pin ---- */
  { LPC_GPIO_TypeDef *g = GP[VP_PORT]; int sh = (VP_PIN & 15) * 2; volatile uint32_t *m = &PM[VP_PORT * 2 + (VP_PIN >> 4)]; uint32_t old = *m;
    g->FIODIR &= ~(1u << VP_PIN);
    *m = (old & ~(3u << sh)) | (0u << sh); ld("G1", "floating pin, pull-up mode", (g->FIOPIN >> VP_PIN) & 1);
    *m = (old & ~(3u << sh)) | (3u << sh); ld("G2", "floating pin, pull-down mode", (g->FIOPIN >> VP_PIN) & 1);
    *m = (old & ~(3u << sh)) | (2u << sh); for (volatile int i = 0; i < 2000; i++); ld("G3", "floating pin, no pull (read after a short wait)", (g->FIOPIN >> VP_PIN) & 1);
    *m = old; }
  /* ---- GPIO output latch / mask ---- */
  { LPC_GPIO_TypeDef *g = GP[VP_PORT]; g->FIOMASK = 0; g->FIODIR |= 1u << VP_PIN; g->FIOSET = 1u << VP_PIN; uint32_t a = (g->FIOPIN >> VP_PIN) & 1;
    g->FIOMASK = 1u << VP_PIN; uint32_t b = (g->FIOPIN >> VP_PIN) & 1; g->FIOCLR = 1u << VP_PIN; g->FIOMASK = 0; uint32_t c = (g->FIOSET >> VP_PIN) & 1;
    g->FIOCLR = 1u << VP_PIN; g->FIODIR &= ~(1u << VP_PIN);
    ld("G4", "FIOPIN after FIOSET (unmasked)", a); ld("G5", "FIOPIN of a masked pin", b); ld("G6", "FIOSET readback after masked FIOCLR (latch kept)", c); }

  /* ---- UART transmitter status ---- */
  { { uint32_t g = GUARD; while (!(LPC_UART0->LSR & LSR_TEMT) && --g) { } }
    LPC_UART0->THR = 'x'; LPC_UART0->THR = 'y'; uint32_t l1 = LPC_UART0->LSR;
    { uint32_t g = GUARD; while (!(LPC_UART0->LSR & LSR_TEMT) && --g) { } }
    uint32_t l2 = LPC_UART0->LSR;
    puts_("\r\n");
    lh("U4", "LSR right after two THR writes", l1); lh("U5", "LSR when idle", l2); }
#ifdef TRY_UNPOWERED
  LPC_SC->PCONP &= ~PCONP_PCUART2; LPC_UART2->LCR = 3; lh("X1", "UART2 LCR written 3 while PCONP bit 24 = 0, read back", LPC_UART2->LCR);
#endif
  puts_("END\r\n");
  for (;;);
}
