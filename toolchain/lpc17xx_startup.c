extern unsigned _etext, _sdata, _edata, _sbss, _ebss, _estack;
int main(void);
void Default_Handler(void) { for (;;); }
void Reset_Handler(void) {
    unsigned *s = &_etext, *d = &_sdata;
    while (d < &_edata) *d++ = *s++;
    for (d = &_sbss; d < &_ebss;) *d++ = 0;
    main();
    for (;;);
}
#define W(n) void n(void) __attribute__((weak, alias("Default_Handler")))
W(NMI_Handler); W(HardFault_Handler); W(MemManage_Handler); W(BusFault_Handler); W(UsageFault_Handler); W(SVC_Handler); W(DebugMon_Handler); W(PendSV_Handler); W(SysTick_Handler);
W(WDT_IRQHandler); W(TIMER0_IRQHandler); W(TIMER1_IRQHandler); W(TIMER2_IRQHandler); W(TIMER3_IRQHandler); W(UART0_IRQHandler); W(UART1_IRQHandler); W(UART2_IRQHandler); W(UART3_IRQHandler);
W(PWM1_IRQHandler); W(I2C0_IRQHandler); W(I2C1_IRQHandler); W(I2C2_IRQHandler); W(SPI_IRQHandler); W(SSP0_IRQHandler); W(SSP1_IRQHandler); W(PLL0_IRQHandler); W(RTC_IRQHandler);
W(EINT0_IRQHandler); W(EINT1_IRQHandler); W(EINT2_IRQHandler); W(EINT3_IRQHandler); W(ADC_IRQHandler); W(BOD_IRQHandler); W(USB_IRQHandler); W(CAN_IRQHandler); W(DMA_IRQHandler);
W(I2S_IRQHandler); W(ENET_IRQHandler); W(RIT_IRQHandler); W(MCPWM_IRQHandler); W(QEI_IRQHandler); W(PLL1_IRQHandler); W(USBActivity_IRQHandler); W(CANActivity_IRQHandler);
/* Vector 7 is the boot ROM checksum (negated sum of vectors 0-6). It is written after linking by toolchain/lpc-checksum.js. */
__attribute__((section(".isr_vector"), used)) void (*const vectors[51])(void) = {
    (void (*)(void))&_estack, Reset_Handler, NMI_Handler, HardFault_Handler, MemManage_Handler, BusFault_Handler, UsageFault_Handler, 0,
    0, 0, 0, SVC_Handler, DebugMon_Handler, 0, PendSV_Handler, SysTick_Handler,
    WDT_IRQHandler, TIMER0_IRQHandler, TIMER1_IRQHandler, TIMER2_IRQHandler, TIMER3_IRQHandler, UART0_IRQHandler, UART1_IRQHandler, UART2_IRQHandler, UART3_IRQHandler,
    PWM1_IRQHandler, I2C0_IRQHandler, I2C1_IRQHandler, I2C2_IRQHandler, SPI_IRQHandler, SSP0_IRQHandler, SSP1_IRQHandler, PLL0_IRQHandler, RTC_IRQHandler,
    EINT0_IRQHandler, EINT1_IRQHandler, EINT2_IRQHandler, EINT3_IRQHandler, ADC_IRQHandler, BOD_IRQHandler, USB_IRQHandler, CAN_IRQHandler, DMA_IRQHandler,
    I2S_IRQHandler, ENET_IRQHandler, RIT_IRQHandler, MCPWM_IRQHandler, QEI_IRQHandler, PLL1_IRQHandler, USBActivity_IRQHandler, CANActivity_IRQHandler };
