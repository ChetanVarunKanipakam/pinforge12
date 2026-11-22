#!/bin/sh
# usage: build_lpc.sh src [out] [extra gcc flags...]   (run from tests/fw; source is lpc/<src>.c) -> out/<out>.bin (boot checksum written) and out/<out>.elf
TC=../../toolchain; mkdir -p out; S=$1; O=${2:-$1}; if [ $# -ge 2 ]; then shift 2; else shift; fi
arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -Wall -Wextra -nostdlib -ffreestanding -ffunction-sections -fdata-sections -I$TC -T $TC/lpc17xx.ld -Wl,--gc-sections "$@" $TC/lpc17xx_startup.c lpc/$S.c -o out/$O.elf -lgcc 2>&1 | grep -v "^$"
arm-none-eabi-objcopy -O binary out/$O.elf out/$O.bin && node $TC/lpc-checksum.js out/$O.bin >/dev/null
