/* Minimal LPC1768 register header for PinForge (CMSIS LPC17xx.h names, so ordinary LPC code builds unchanged). */
#ifndef LPC17XX_H
#define LPC17XX_H
#include <stdint.h>
typedef struct { volatile uint32_t FIODIR, RESERVED0[3], FIOMASK, FIOPIN, FIOSET, FIOCLR; } LPC_GPIO_TypeDef;
typedef struct { volatile uint32_t PINSEL0, PINSEL1, PINSEL2, PINSEL3, PINSEL4, PINSEL5, PINSEL6, PINSEL7, PINSEL8, PINSEL9, PINSEL10, RESERVED0[5],
  PINMODE0, PINMODE1, PINMODE2, PINMODE3, PINMODE4, PINMODE5, PINMODE6, PINMODE7, PINMODE8, PINMODE9, PINMODE_OD0, PINMODE_OD1, PINMODE_OD2, PINMODE_OD3, PINMODE_OD4, I2CPADCFG; } LPC_PINCON_TypeDef;
typedef struct { volatile uint32_t FLASHCFG, RESERVED0[31], PLL0CON, PLL0CFG, PLL0STAT, PLL0FEED, RESERVED1[4], PLL1CON, PLL1CFG, PLL1STAT, PLL1FEED, RESERVED2[4],
  PCON, PCONP, RESERVED3[15], CCLKCFG, USBCLKCFG, CLKSRCSEL, RESERVED4[12], EXTINT, RESERVED5, EXTMODE, EXTPOLAR, RESERVED6[12], RSID, RESERVED7[7], SCS, RESERVED8, PCLKSEL0, PCLKSEL1; } LPC_SC_TypeDef;
typedef struct { volatile uint32_t IR, TCR, TC, PR, PC, MCR, MR0, MR1, MR2, MR3, CCR, CR0, CR1, RESERVED0[2], EMR, RESERVED1[12], CTCR; } LPC_TIM_TypeDef;
typedef struct {
  union { volatile uint8_t RBR; volatile uint8_t THR; volatile uint8_t DLL; uint32_t RESERVED0; };
  union { volatile uint8_t DLM; volatile uint32_t IER; };
  union { volatile uint32_t IIR; volatile uint8_t FCR; };
  volatile uint8_t LCR; uint8_t RESERVED1[7];
  volatile uint8_t LSR; uint8_t RESERVED2[7];
  volatile uint8_t SCR; uint8_t RESERVED3[3];
  volatile uint32_t ACR;
  volatile uint8_t ICR; uint8_t RESERVED4[3];
  volatile uint8_t FDR; uint8_t RESERVED5[7];
  volatile uint8_t TER;
} LPC_UART_TypeDef;
typedef struct { volatile uint32_t IntStatus, IO0IntStatR, IO0IntStatF, IO0IntClr, IO0IntEnR, IO0IntEnF, RESERVED0[3], IO2IntStatR, IO2IntStatF, IO2IntClr, IO2IntEnR, IO2IntEnF; } LPC_GPIOINT_TypeDef;
typedef struct { volatile uint32_t ADCR, ADGDR, RESERVED0, ADINTEN, ADDR0, ADDR1, ADDR2, ADDR3, ADDR4, ADDR5, ADDR6, ADDR7, ADSTAT, ADTRM; } LPC_ADC_TypeDef;
typedef struct { volatile uint32_t I2CONSET, I2STAT, I2DAT, I2ADR0, I2SCLH, I2SCLL, I2CONCLR, MMCTRL, I2ADR1, I2ADR2, I2ADR3, I2DATA_BUFFER, I2MASK0, I2MASK1, I2MASK2, I2MASK3; } LPC_I2C_TypeDef;
typedef struct { volatile uint32_t CTRL, LOAD, VAL, CALIB; } SysTick_TypeDef;

#define LPC_GPIO0   ((LPC_GPIO_TypeDef *)0x2009C000)
#define LPC_GPIO1   ((LPC_GPIO_TypeDef *)0x2009C020)
#define LPC_GPIO2   ((LPC_GPIO_TypeDef *)0x2009C040)
#define LPC_GPIO3   ((LPC_GPIO_TypeDef *)0x2009C060)
#define LPC_GPIO4   ((LPC_GPIO_TypeDef *)0x2009C080)
#define LPC_GPIOINT ((LPC_GPIOINT_TypeDef *)0x40028080)
#define LPC_PINCON  ((LPC_PINCON_TypeDef *)0x4002C000)
#define LPC_SC      ((LPC_SC_TypeDef *)0x400FC000)
#define LPC_TIM0    ((LPC_TIM_TypeDef *)0x40004000)
#define LPC_TIM1    ((LPC_TIM_TypeDef *)0x40008000)
#define LPC_TIM2    ((LPC_TIM_TypeDef *)0x40090000)
#define LPC_TIM3    ((LPC_TIM_TypeDef *)0x40094000)
#define LPC_ADC     ((LPC_ADC_TypeDef *)0x40034000)
#define LPC_I2C0    ((LPC_I2C_TypeDef *)0x4001C000)
#define LPC_I2C1    ((LPC_I2C_TypeDef *)0x4005C000)
#define LPC_I2C2    ((LPC_I2C_TypeDef *)0x400A0000)
#define LPC_UART0   ((LPC_UART_TypeDef *)0x4000C000)
#define LPC_UART1   ((LPC_UART_TypeDef *)0x40010000)
#define LPC_UART2   ((LPC_UART_TypeDef *)0x40098000)
#define LPC_UART3   ((LPC_UART_TypeDef *)0x4009C000)
#define SysTick     ((SysTick_TypeDef *)0xE000E010)

/* IRQ numbers */
typedef enum { WDT_IRQn = 0, TIMER0_IRQn, TIMER1_IRQn, TIMER2_IRQn, TIMER3_IRQn, UART0_IRQn, UART1_IRQn, UART2_IRQn, UART3_IRQn, PWM1_IRQn,
  I2C0_IRQn, I2C1_IRQn, I2C2_IRQn, SPI_IRQn, SSP0_IRQn, SSP1_IRQn, PLL0_IRQn, RTC_IRQn, EINT0_IRQn, EINT1_IRQn, EINT2_IRQn, EINT3_IRQn, ADC_IRQn,
  BOD_IRQn, USB_IRQn, CAN_IRQn, DMA_IRQn, I2S_IRQn, ENET_IRQn, RIT_IRQn, MCPWM_IRQn, QEI_IRQn, PLL1_IRQn, USBActivity_IRQn, CANActivity_IRQn } IRQn_Type;

/* PCONP bits */
#define PCONP_PCTIM0 (1u<<1)
#define PCONP_PCTIM1 (1u<<2)
#define PCONP_PCUART0 (1u<<3)
#define PCONP_PCUART1 (1u<<4)
#define PCONP_PCI2C0 (1u<<7)
#define PCONP_PCI2C1 (1u<<19)
#define PCONP_PCI2C2 (1u<<26)
#define PCONP_PCADC (1u<<12)
#define PCONP_PCGPIO (1u<<15)
#define PCONP_PCTIM2 (1u<<22)
#define PCONP_PCTIM3 (1u<<23)
#define PCONP_PCUART2 (1u<<24)
#define PCONP_PCUART3 (1u<<25)
/* SCS / PLL0 bits */
#define SCS_OSCEN (1u<<5)
#define SCS_OSCSTAT (1u<<6)
#define PLL0STAT_PLLE (1u<<24)
#define PLL0STAT_PLLC (1u<<25)
#define PLL0STAT_PLOCK (1u<<26)
/* UART bits */
#define I2C_AA (1u<<2)
#define I2C_SI (1u<<3)
#define I2C_STO (1u<<4)
#define I2C_STA (1u<<5)
#define I2C_I2EN (1u<<6)
#define ADCR_PDN (1u<<21)
#define ADCR_BURST (1u<<16)
#define ADCR_START_NOW (1u<<24)
#define ADGDR_DONE (1u<<31)
#define LSR_RDR (1u<<0)
#define LSR_OE (1u<<1)
#define LSR_THRE (1u<<5)
#define LSR_TEMT (1u<<6)
#define LCR_DLAB (1u<<7)

static inline void NVIC_EnableIRQ(IRQn_Type n) { *(volatile uint32_t *)(0xE000E100 + 4 * ((unsigned)n >> 5)) = 1u << ((unsigned)n & 31); }
static inline void NVIC_DisableIRQ(IRQn_Type n) { *(volatile uint32_t *)(0xE000E180 + 4 * ((unsigned)n >> 5)) = 1u << ((unsigned)n & 31); }
static inline void NVIC_SetPriority(IRQn_Type n, uint32_t p) { *(volatile uint8_t *)(0xE000E400 + (unsigned)n) = (uint8_t)(p << 3); }   /* 5 implemented bits */
static inline void __disable_irq(void) { __asm volatile("cpsid i" ::: "memory"); }
static inline void __enable_irq(void) { __asm volatile("cpsie i" ::: "memory"); }
static inline void __WFI(void) { __asm volatile("wfi"); }
#endif
