# LPC1768 in PinForge: work update

Status as of 20 Nov 2026. All 14 test suites pass (365 checks); `sh tests/run-all.sh` runs them.

## Done

**Architecture (step 1)**
- The single-function emulator is now `src/core` (Cortex-M CPU, exceptions, NVIC, SysTick, bus), `src/chip` (one file per chip) and `src/peripheral` (reusable peripherals plugged in with `attach()`).
- The UI script was split into modules with a byte-identical result; `tools/build.js` assembles the one-file `public/index.html`.
- A differential test runs the frozen original emulator and the modular one in lockstep on 50 Blue Pill firmware images and compares CPU state, interrupts and every host callback.

**LPC1768 chip model (`src/chip/lpc1768.js` + peripherals)**
- Cortex-M3 with 5 NVIC priority bits; 512 KB flash at 0, 32 KB local SRAM, two 16 KB AHB banks.
- Boot ROM behaviour: only starts code with a valid vector checksum.
- System control: 4 MHz IRC at reset, 12 MHz main oscillator, PLL0 with the AA/55 feed sequence and lock time, CCLKCFG, FLASHCFG, PCONP power gating, PCLKSEL0/1.
- Pin connect (PINSEL, PINMODE, open drain), fast GPIO (FIODIR, FIOMASK, FIOPIN, FIOSET, FIOCLR), GPIO interrupts on ports 0 and 2, EINT0-3.
- Timer0-3 (timer mode, prescaler, four match registers with interrupt / reset / stop).
- UART0-3 (fractional baud rate, 16-byte FIFOs, THRE / RX / timeout / overrun interrupts; pins must be selected in PINSEL).
- ADC, 8 channels (software start and burst, 65-clock conversions, DONE / OVERRUN, interrupt).
- I2C0, I2C1, I2C2 as master: the status-code state machine (0x08 / 0x10 start, 0x18 / 0x20 / 0x28 / 0x30 / 0x38 transmit, 0x40 / 0x48 / 0x50 / 0x58 receive), I2CONSET / I2CONCLR, I2SCLH / I2SCLL bit timing, interrupt on SI. It uses the same bus model as the Blue Pill: pull-up resistors, rise time, hang, arbitration lost, clock stretching, bus held low, and the I2C Monitor / waveform. SDA / SCL pins show as alternate-function open drain when PINSEL selects them (I2C1 on P0.0 / P0.1 or P0.19 / P0.20).
- Warnings (`host.diag` and the I2C Monitor) for mistakes real silicon punishes: flash timing too short for CCLK, PLL0 out of range, unpowered peripheral used, UART or ADC pin not selected, pull resistor left on an ADC pin, wrong boot checksum.

**Toolchain and server**
- `toolchain/lpc17xx.h` (CMSIS names; every register offset checked against UM10360 with compile-time assertions), startup with the 35 LPC interrupt vectors, linker script, `lpc-checksum.js`.
- The compile server takes `{target:'lpc1768'}` and writes the boot checksum.

**Site**
- Board selector (Blue Pill / PinForge LPC1768 board). A board is one object in `src/ui/board-*.js`.
- LPC1768 board drawn from your reference layout; 76 header pins with unique ids; hover tooltips list alternate functions.
- Parts menu offers GPIO, ADC and I2C parts on this board (LED, button, LCD, 7-segment, keypad, LED bar, pot, buzzer, OLED, EEPROM, RTC and the I2C sensors); only the servo is hidden.
- Six examples: start here (blink + button + UART0), Timer0 + GPIO interrupts, PLL0 at 100 MHz, ADC with a potentiometer, I2C2 EEPROM boot counter, LED-bar sweep.
- The CPU Registers tab shows LPC state; Load... fixes the boot checksum of a binary the way an ISP tool does.
- Split view is available on narrow screens (stacked).
- The Board specs tab was removed on request.

**Real-hardware comparison**
- `tests/hw-validation/`: one firmware (`hw_validate.bin`), its predicted output (`expected_sim.txt`) and a comparison tool. **Not yet run on a board**; it is optional.

## Assumptions the board could confirm
1. A timer with a prescaler resets on the prescaled boundary: period (MR0+1) x (PR+1) PCLK (validation line T2).
2. MR0 = 0 with reset matches immediately when counting starts (T3).
3. PLL0 lock time is 50 us (P2).
4. Connect set in the same feed as enable connects by itself after lock (P7/P8).
5. ADC: a control-register write with START = 001 restarts a conversion already running and clears the global DONE flag; a conversion starts on every such write even if START was left at 001 (not yet in the validation firmware).
6. Registers of an unpowered peripheral read 0 and ignore writes.
7. I2C timing: START takes half a bit period, a repeated START 1.5, a byte plus ACK 9, a STOP 1; STA is not cleared by hardware after the START (software clears it); STO together with STA sends a STOP followed by a START; SI is not set after a STOP.

## Core behaviour change
A level-sensitive interrupt is no longer re-pended while its own handler is running; it re-pends on exception return if the line is still asserted (as on a real NVIC). Before, a peripheral register write inside a handler could trigger a second entry. One Blue Pill test program changed because of it; every other Blue Pill behaviour is identical (the equivalence test applies the same guard to the frozen reference).

## Not done
- SSP/SPI, PWM1, timer capture and match outputs, DAC, RTC, WDT, DMA, USB, Ethernet, CAN, I2S, QEI, RIT, UART modem lines / error flags / auto-baud.
- The servo is therefore hidden on this board. I2C slave mode, monitor mode and the data buffer register are not modelled.
- RESET and ISP switches are drawn but not simulated; the UART0 and JTAG/SWD headers are artwork only (not wirable).
- The alternate-function table is informational except GPIO, UART TXD/RXD, ADC and EINT.
- Cycle counts are an approximation of silicon; peripheral timing is exact in CPU cycles, instruction timing is not.

## How it was checked
- Headless: firmware compiled with the real toolchain runs on the emulator (`t_lpc.js`, 66 checks), the page is driven in jsdom (`e2e_lpc_board.js`, 36 checks), and the compile server is tested end to end (`t_server.js`).
- The board canvas was rendered to an image and inspected. It has not been opened in a real browser by the author.

## Suggested order from here
PWM1 / timer match outputs, then SSP/SPI and DMA; Black Pill, multi-page site and HAL/CubeMX as in the original plan.
