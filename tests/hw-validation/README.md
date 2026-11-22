# Simulator vs. real LPC1768

`hw_validate.c` prints one line per measurement on **UART0** (P0.2 = TXD0, P0.3 = RXD0, **9600 8N1**) and ends with `END`.
It runs from the internal 4 MHz RC oscillator only, so it is safe on any LPC1768 board.

1. Build: `node tests/hw-validation/run-sim.js` compiles the firmware, runs it in the simulator and writes
   `hw_validate.bin` (boot checksum already patched, flash it as-is) and `expected_sim.txt` (what the simulator predicts).
2. Flash `hw_validate.bin` to the board with your usual tool, open a serial terminal at 9600 8N1 and reset the board.
   Save everything up to `END` to `board.txt`.
3. Compare: `node tests/hw-validation/compare.js board.txt`

Timer lines T1-T5 measure 8 consecutive periods and may differ by up to 24 cycles (poll-loop jitter); everything else must match exactly.
`P2` (PLL lock time) is reported as a note: whatever the board measures becomes the model's value.
`R1-R12` just report what your boot ROM leaves in the registers.
Test **G** uses header pin **P2.7** (`VP_PORT` / `VP_PIN` at the top of the file) - change it if that pin is wired to something on your board.
Add `-DTRY_UNPOWERED` to also read a peripheral whose power bit is off (**X1**; skipped by default because a bus fault on the real chip would stop the output).

## What each line is asking the hardware

| Line | Question the model currently assumes an answer to |
|------|----------------------------------------------------|
| R1-R14 | PCONP / FLASHCFG / PLL / PCLKSEL / RSID values at user-code entry; 5 implemented NVIC priority bits |
| U1-U3, U5 | UART0 reset values; LSR/IIR |
| T1 | 8 timer periods with MR0 reset = 8 x (MR0+1) PCLK cycles |
| **T2** | **With a prescaler the reset happens on the prescaled boundary: period (MR0+1) x (PR+1) PCLK** (the alternative is one PCLK after the match) |
| **T3** | MR0 = 0 with reset: the comparator already sees TC == MR0 when counting starts, so the period is one PCLK |
| T4, T5 | PCLKSEL divider and TC rate |
| P1-P3 | PLL0STAT bits right after enable and when locked; **P2 = lock time** (the model uses 50 us) |
| P4-P6 | Connect / disconnect / disable status bits |
| **P7, P8** | **Connect requested in the same feed as enable (before lock): does it connect by itself once locked?** (the model says yes) |
| G1-G3 | Floating-pin level with pull-up / pull-down / no pull |
| G4-G6 | FIOSET, FIOMASK and FIOCLR semantics |
| U4 | LSR right after two back-to-back THR writes (FIFO enabled) |

Every mismatch is a bug in the model (or a wrong assumption written down here): send the `compare.js` output back and it gets fixed, then the
expected file is regenerated.
