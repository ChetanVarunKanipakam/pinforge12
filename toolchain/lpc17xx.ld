/* LPC1768: 512 KB flash at 0, 32 KB local SRAM at 0x10000000 (the top 32 bytes belong to the boot ROM's IAP code). */
MEMORY { FLASH (rx) : ORIGIN = 0x00000000, LENGTH = 512K
         RAM (rwx)  : ORIGIN = 0x10000000, LENGTH = 32736 }
ENTRY(Reset_Handler)
SECTIONS {
  .isr_vector : { KEEP(*(.isr_vector)) } > FLASH
  .text : { *(.text*) *(.rodata*) . = ALIGN(4); _etext = .; } > FLASH
  .data : AT(_etext) { _sdata = .; *(.data*) . = ALIGN(4); _edata = .; } > RAM
  .bss : { _sbss = .; *(.bss*) *(COMMON) . = ALIGN(4); _ebss = .; } > RAM
  _estack = ORIGIN(RAM) + LENGTH(RAM);
}
