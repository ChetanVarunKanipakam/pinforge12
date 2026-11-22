// Every sensor model is exercised by real firmware (tests/fw/t_*.c) running in the page: values are checked against the datasheet formulas.
const {sim,wires,part,ck}=require('./sens');
const V33='bluepill:3V3.2',V5='bluepill:5V';
const pu=(v=V33)=>[[{id:'r1',type:'res',x:500,y:100,attrs:{value:'4700'}},{id:'r2',type:'res',x:500,y:140,attrs:{value:'4700'}}],[['r1:1','bluepill:PB10','green'],['r1:2',v,'red'],['r2:1','bluepill:PB11','blue'],['r2:2',v,'red']]];
const num=(o,k)=>{const m=o.match(new RegExp('\\b'+k+'=(-?\\d+)'));return m?+m[1]:NaN};
const near=(a,b,tol)=>Math.abs(a-b)<=tol;
(async()=>{
 // ===== MPU-6050
 {let T=await sim('t_mpu',[part('mpu6050',{})],wires('dev1',V33),{secs:3});let o=T.out;
  ck('MPU-6050: WHO_AM_I = 0x68 and it starts asleep (PWR_MGMT_1 = 0x40)',/WHO=68 PM1=40/.test(o),o);
  ck('  data registers read zero while asleep',/ASLEEP r=0 az=0/.test(o),o);
  ck('  right after wake-up the accel/gyro are still starting (20/35 ms)',/EARLY az=0 gx=0/.test(o),o);
  ck('  1 g on Z at +-2 g is 16384 LSB; 25 C is raw -3920 (T = raw/340 + 36.53)',/ax=0 ay=0 az=16384 t=-3920 gx=0 gy=0 gz=0/.test(o),o);
  ck('  +-8 g range gives 4096 LSB/g',/FS8 az=4096/.test(o),o);
  ck('  DEVICE_RESET restores PWR_MGMT_1 = 0x40',/RESET PM1=40/.test(o),o);
  T=await sim('t_mpu',[part('mpu6050',{ax:'0.5',ay:'-0.25',az:'0.8',gx:'100',gy:'-50',gz:'10',temp:'30'})],wires('dev1',V33),{secs:3});o=T.out;
  ck('  inspector values scale into registers (0.5 g=8192, -0.25 g=-4096, 0.8 g=13107, 100 dps=13100, 30 C=-2220)',/ax=8192 ay=-4096 az=13107 t=-2220 gx=13100 gy=-6550 gz=1310/.test(o),o);
  ck('  range changes rescale: 0.8 g at +-8 g = 3277, 100 dps at +-2000 = 1640',/FS8 az=3277 gx=1640/.test(o),o);
  T=await sim('t_mpu',[part('mpu6050',{})],wires('dev1',V33,[['dev1:AD0',V33,'red']]),{secs:1.5});
  ck('  AD0 high moves it to 0x69 (firmware at 0x68 gets NACKs)',/WHO=FF PM1=FF/.test(T.out)&&/0x68 W NACK/.test(T.mon),T.out);
  T=await sim('t_mpu_int',[part('mpu6050',{})],wires('dev1',V33,[['dev1:INT','bluepill:PB1','orange']]),{secs:3.5});o=T.out;
  ck('  data-ready INT at 100 Hz drives an EXTI line: about 100 interrupts in 1 s',near(num(o,'EDGES_100HZ'),100,4),o);
  ck('  latched INT stays high until INT_STATUS is read',/LATCH before=1 after_read=0/.test(o),o);}
 // ===== BMP280 / BME280: firmware applies Bosch's integer compensation to the raw data
 {let T=await sim('t_bmp',[part('bmp280',{})],wires('dev1',V33),{secs:2});let o=T.out;
  ck('BMP280: chip ID 0x58 at 0x76, startup status bit, skipped-value data before the first measurement',/ADDR=76 ID=58 STATUS_EARLY=01/.test(o)&&/RAW0=800000 800000/.test(o),o);
  ck('  forced mode: measuring bit seen, then back to sleep',/MEAS polls>0=1 mode_after=0/.test(o),o);
  ck('  Bosch integer formula returns 25.00 C and 1013.25 hPa',near(num(o,'T100'),2500,2)&&near(num(o,'P'),101325,6),o);
  T=await sim('t_bmp',[part('bmp280',{temp:'-5.5',pres:'900'})],wires('dev1',V33),{secs:2});o=T.out;
  ck('  other conditions: -5.50 C / 900.00 hPa',near(num(o,'T100'),-550,2)&&near(num(o,'P'),90000,6),o);
  T=await sim('t_bmp',[part('bme280',{temp:'-10',pres:'950',hum:'80'})],wires('dev1',V33),{secs:2});o=T.out;
  ck('BME280: ID 0x60, -10 C / 950 hPa / 80 %RH',/ID=60/.test(o)&&near(num(o,'T100'),-1000,3)&&near(num(o,'P'),95000,6)&&near(num(o,'H10'),800,3),o);
  T=await sim('t_bmp',[part('bme280',{temp:'37.5',pres:'1100',hum:'20'})],wires('dev1',V33),{secs:2});o=T.out;
  ck('  37.5 C / 1100 hPa / 20 %RH',near(num(o,'T100'),3750,3)&&near(num(o,'P'),110000,6)&&near(num(o,'H10'),200,3),o);
  T=await sim('t_bmp',[part('bmp280',{})],wires('dev1',V33,[['dev1:SDO',V33,'red']]),{secs:2});
  ck('  SDO high selects 0x77',/ADDR=77 ID=58/.test(T.out),T.out);
  T=await sim('t_bmp',[part('bmp280',{})],wires('dev1',V33,[['dev1:CSB','bluepill:GND.3','black']]),{secs:2});
  ck('  CSB low selects SPI: no I2C answer',/ID=FF/.test(T.out)&&!/ID=58/.test(T.out),T.out);}
 // ===== DS3231 + the module's EEPROM
 {const T=await sim('t_rtc',[part('ds3231',{start:'2026-11-15 10:00:00',temp:'27.25'})],wires('dev1',V33,[['dev1:SQW','bluepill:PB1','orange']]),{secs:14});const o=T.out;
  ck('DS3231: RTC (0x68) and the AT24C32 (0x57) both answer',/RTC=1 EE=1/.test(o),o);
  ck('  starts from the configured time; Sunday = 1',/NOW 26-11-15 10:00:00 dow=1/.test(o),o);
  ck('  time registers are written field by field (day 31 in a 30-day month survives until rollover)',/SET 30-12-31 23:59:58 dow=4/.test(o),o);
  ck('  runs in real time: 3 s later it is 2031-01-01 00:00:01 and the weekday counter advanced',/AFTER3S 31-01-01 00:00:01 dow=5/.test(o),o);
  ck('  alarm 1 sets A1F and pulls INT/SQW low; clearing the flag releases it',/STATUS0=00 SQW=1/.test(o)&&/STATUS1=01 SQW=0/.test(o)&&/STATUS2=00 SQW=1/.test(o),o);
  ck('  temperature registers (0.25 C steps)',/TEMP=27\.25/.test(o),o);
  ck('  EEPROM: NACK while the write cycle runs (ACK polling), data readable afterwards',/EE wr=0 polls>0=1 read=DS32/.test(o),o);}
 // ===== DS1307
 {let T=await sim('t_ds1307',[part('ds1307',{battery:'no'})],wires('dev1',V5),{secs:6});let o=T.out;
  ck('DS1307: refuses a 400 kHz bus (100 kHz maximum)',/FAST400=-1/.test(o)&&/supports at most 100 kHz/.test(T.mon),o+T.mon);
  ck('  without a battery the clock starts halted (CH=1); writing the seconds starts it',/CH=1/.test(o)&&/T=09:15:32 CH=0/.test(o),o);
  ck('  56 bytes of RAM keep data',/RAM=A55A77/.test(o),o);
  T=await sim('t_ds1307',[part('ds1307',{})],wires('dev1',V33),{secs:2});
  ck('  at 3.3 V it runs from its battery and ignores I2C (needs 4.5 V)',/FAST400=-1/.test(T.out)&&/SEC0=FFFFFFFF|SEC0=FF/.test(T.out),T.out);}
 // ===== BH1750
 {let T=await sim('t_bh',[part('bh1750',{lux:'250'})],wires('dev1',V33),{secs:3});let o=T.out;
  ck('BH1750: one-time H-resolution measurement is not ready after 10 ms, then reads 1.2 counts per lux',/EARLY=0 RAW=300 LUX10=250/.test(o),o);
  ck('  continuous mode and measurement-time register (MT 138 doubles the count)',/CONT=300 MT138=600/.test(o),o);
  T=await sim('t_bh',[part('bh1750',{lux:'250'})],wires('dev1',V33,[['dev1:ADDR',V33,'red']]),{secs:2});
  ck('  ADDR high moves it to 0x5C',/PWRON=1/.test(T.out),T.out);}
 // ===== AT24C256 EEPROM
 {const [rp,rw]=pu();let T=await sim('t_eep',[part('at24',{size:'24C256'})].concat(rp),wires('dev1',V33).concat(rw),{secs:3});let o=T.out;
  ck('AT24C256: page write wraps inside the 64-byte page (0x00 holds 17, 0x30 was overwritten by 65)',/WRAP\[0\]=17/.test(o)&&/\[0x30\]=65/.test(o)&&/\[0x3F\]=16/.test(o)&&/\[0x40\]=255/.test(o),o);
  ck('  the 5 ms write cycle is visible through ACK polling',/POLL_MS=5 POLLS>1=1/.test(o),o);
  T=await sim('t_eep',[part('at24',{size:'24C256'})].concat(rp),wires('dev1',V33,[['dev1:WP',V33,'red']]).concat(rw),{secs:3});o=T.out;
  ck('  WP high: writes are acknowledged but ignored',/WR=0/.test(o)&&/\[0x30\]=255 \[0x3F\]=255/.test(o),o);
  T=await sim('t_eep',[part('at24',{size:'24C256'})].concat(rp),wires('dev1',V33,[['dev1:A0',V33,'red']]).concat(rw),{secs:2});
  ck('  A0 high moves it to 0x51',/WR=1/.test(T.out),T.out);}
 // ===== LCD 1602 with PCF8574 backpack
 {let T=await sim('t_lcd',[part('lcdi2c',{})],wires('dev1',V5),{secs:2});
  const rows=JSON.parse(T.ev('(()=>{const L=devOf(parts[0]);const s=r=>Array.from(L.dd.slice(r?0x40:0,(r?0x40:0)+16)).map(c=>String.fromCharCode(c)).join("");return JSON.stringify([s(0),s(1),L.pw,L.disp])})()'));
  ck('LCD backpack: HD44780 4-bit initialisation over the PCF8574 shows both lines',rows[0]=='I2C LCD works   '&&rows[1]=='Line 2          '&&rows[2]===true&&/RC=0/.test(T.out),JSON.stringify(rows)+T.out);
  T=await sim('t_lcd',[part('lcdi2c',{})],wires('dev1',V33),{secs:2});
  ck('  on 3.3 V the expander answers but the LCD itself stays dark',/RC=0/.test(T.out)&&T.ev('devOf(parts[0]).pw')===false,T.out);}
 process.exit(require('./sens').fails?1:0)})();
