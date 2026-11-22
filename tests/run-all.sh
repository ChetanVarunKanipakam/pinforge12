#!/bin/sh
# Builds the test firmware and runs every suite. From the repo root:  sh tests/run-all.sh   (needs arm-none-eabi-gcc and `npm i --no-save jsdom`)
cd "$(dirname "$0")" || exit 1
# public/index.html is generated from src/: it must be up to date
PF_OUT=/tmp/pf_check.html node ../tools/build.js >/dev/null && cmp -s /tmp/pf_check.html ../public/index.html || { echo "public/index.html is stale: run  node tools/build.js"; exit 1; }
(cd fw && for t in t_write t_read t_irq t_fast t_phy t_remap t_mpu t_mpu_int t_bmp t_rtc t_ds1307 t_bh t_eep t_lcd t_bus t_bus27_400 i2c_scan mpu6050_read bme280_oled ds3231_lcd_clock eeprom_counter oled_hello oled_anim; do ./build.sh $t >/dev/null 2>&1 || { echo "firmware build failed: $t"; exit 1; }; done) || exit 1
(cd fw && for t in t_hdr t_clk t_gpio t_tmr t_uart t_ext; do ./build_lpc.sh $t >/dev/null 2>&1 || { echo "LPC firmware build failed: $t"; exit 1; }; done
 ./build_lpc.sh t_clk t_clk_nf -DNOFLASH >/dev/null 2>&1 && ./build_lpc.sh t_gpio t_gpio_off -DUNPOWERED >/dev/null 2>&1 && ./build_lpc.sh t_tmr t_tmr_pr3 -DPRV=3 >/dev/null 2>&1 && ./build_lpc.sh t_tmr t_tmr_p1 -DPCLK1 >/dev/null 2>&1 && ./build_lpc.sh t_tmr t_tmr_t2 -DT2 >/dev/null 2>&1 && ./build_lpc.sh t_uart t_uart_poll -DPOLL >/dev/null 2>&1 && ./build_lpc.sh t_uart t_uart_tx -DTXINT >/dev/null 2>&1 && ./build_lpc.sh t_uart t_uart_rx -DRXINT >/dev/null 2>&1 && ./build_lpc.sh t_uart t_uart_nopin -DPOLL -DNOPIN >/dev/null 2>&1 && ./build_lpc.sh t_adc >/dev/null 2>&1 && ./build_lpc.sh t_adc t_adc_nopin -DNOPIN >/dev/null 2>&1 && ./build_lpc.sh t_adc t_adc_nopower -DNOPOWER >/dev/null 2>&1 && ./build_lpc.sh t_adc t_adc_nopull -DNOPULLMODE >/dev/null 2>&1 && ./build_lpc.sh t_adc t_adc_irq -DIRQ >/dev/null 2>&1 && ./build_lpc.sh t_adc t_adc_burst -DBURST >/dev/null 2>&1 && ./build_lpc.sh t_i2c t_i2c_b0 -DBUS=0 >/dev/null 2>&1 && ./build_lpc.sh t_i2c t_i2c_b1 -DBUS=1 >/dev/null 2>&1 && ./build_lpc.sh t_i2c t_i2c_b2 -DBUS=2 >/dev/null 2>&1 && ./build_lpc.sh t_i2c t_i2c_irq -DBUS=2 -DIRQ >/dev/null 2>&1 && ./build_lpc.sh t_i2c t_i2c_nopower -DBUS=2 -DNOPOWER >/dev/null 2>&1) || { echo "LPC firmware variant build failed"; exit 1; }
rc=0
for t in t_core1 t_core2 t_core3 t_ssd t_isa e2e_i2c e2e_more e2e_sensors e2e_rules e2e_examples t_equiv t_lpc t_server e2e_lpc_board; do
  printf "== %-12s" $t; out=$(node $t.js 2>&1); r=$?
  p=$(echo "$out" | grep -c "^PASS"); f=$(echo "$out" | grep -c "^FAIL"); echo "$p passed, $f failed"
  echo "$out" | grep "^FAIL" | cut -c1-200 ; [ $r -ne 0 ] && rc=1
done
[ $rc -eq 0 ] && echo "ALL TESTS PASSED" || echo "SOME TESTS FAILED"; exit $rc
