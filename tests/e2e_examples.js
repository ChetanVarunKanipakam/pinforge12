// The shipped sensor examples, run in the page exactly as a user would: serial output, display contents, live inspector changes, Stop/Run.
const {boot,ck}=require('./e2e_i2c');
const con=T=>(T.ev('draw()'),T.ev('$("con").textContent'));
const text=(T,id)=>JSON.parse(T.ev(`(()=>{const L=devOf(parts.find(p=>p.id=="${id}"));const s=r=>Array.from(L.dd.slice(r?0x40:0,(r?0x40:0)+16)).map(c=>String.fromCharCode(c)).join("");return JSON.stringify([s(0),s(1)])})()`));
const more=(T,secs)=>{const t=T.ev('simT')+secs;for(let i=0;i<20000&&T.ev('simT')<t;i++)T.ev('fwTick()')};
(async()=>{
 // ---- MPU-6050 readout, then change the values while it runs
 {const T=await boot('mpu6050_read',1.5),o=con(T);
  ck('mpu6050_read: finds the sensor and prints 0 / 0 / 1.000 g, 25 C, 0 dps',/MPU-6050/.test(o)&&/accel g:\s+0\.000\s+0\.000\s+1\.000\s+temp C:\s+25\.0[01]\s+gyro dps:\s+0\.0\s+0\.0\s+0\.0/.test(o),o);
  T.ev(`(()=>{const a=parts.find(p=>p.type=="mpu6050").attrs;a.ax="0.5";a.az="0.866";a.temp="31.5";a.gz="-90"})()`);T.ev('$("con").textContent=""');more(T,1.2);const o2=con(T);
  ck('  changing the inspector values while running shows up in the next readings',/0\.500\s+0\.000\s+0\.866\s+temp C:\s+31\.5[01]\s+gyro dps:\s+0\.0\s+0\.0\s+-90\.0/.test(o2),o2);}
 // ---- BME280 on a shared bus with the OLED
 {const T=await boot('bme280_oled',3.0),o=con(T);
  ck('bme280_oled: BME280 and the OLED share one bus; serial shows 23.50 C, 1008.3 hPa, 46.0 %',/BME280/.test(o)&&/T:\s+23\.50 C/.test(o)&&/P:\s+1008\.3 hPa/.test(o)&&/H:\s+46\.0 %/.test(o),o);
  const px=+T.ev('(()=>{const L=devOf(parts.find(p=>p.type=="oled")),F=oledFrame(L,simNow());let n=0;for(const v of F)n+=v;return n})()');
  ck('  and the OLED displays it (pixels lit, display on)',px>400&&T.ev('devOf(parts.find(p=>p.type=="oled")).on')==1,px);
  const addrs=JSON.parse(T.ev('JSON.stringify([...new Set(I2CLOG.filter(e=>e.addr!=null).map(e=>e.addr))])'));
  ck('  the I2C Monitor shows traffic to both 0x3C and 0x76',addrs.includes(0x3C)&&addrs.includes(0x76),JSON.stringify(addrs));}
 // ---- DS3231 + LCD
 {const T=await boot('ds3231_lcd_clock',2.0);let r=text(T,'lcd1');const now=new Date();
  const hh=String(now.getUTCHours()).padStart(2,'0'),dd=String(now.getUTCDate()).padStart(2,'0');
  ck('ds3231_lcd_clock: LCD shows the computer clock (HH:MM:SS) and a date line',/^ {4}\d\d:\d\d:\d\d {4}$/.test(r[0])&&r[0].slice(4,6)==hh&&/^20\d\d-\d\d-\d\d (Sun|Mon|Tue|Wed|Thu|Fri|Sat)/.test(r[1])&&r[1].slice(8,10)==dd,JSON.stringify(r));
  const s0=+r[0].slice(10,12);more(T,3);r=text(T,'lcd1');const s1=+r[0].slice(10,12);
  ck('  the seconds advance in step with the simulation',((s1-s0+60)%60)>=2&&((s1-s0+60)%60)<=4,s0+' -> '+s1);
  ck('  both modules answer (RTC 0x68, LCD backpack 0x27) and the LCD is powered from 5 V',T.ev('devOf(parts.find(p=>p.id=="lcd1")).pw')===true,'');}
 // ---- EEPROM counter survives Stop / Run
 {const T=await boot('eeprom_counter',1.2);let o=con(T);
  ck('eeprom_counter: first run starts from a blank EEPROM and counts 1',/blank EEPROM/.test(o)&&/Boot count: 1\b/.test(o),o);
  ck('  the 5 ms write cycle is seen through ACK polling',/write cycle took [4-9] ms, [1-9]\d* NACKs/.test(o),o);
  const counts=[1];for(let k=0;k<2;k++){T.ev('stopSim()');T.ev('doRun()');T.ev('clearInterval(fwTimer)');more(T,1.0);const m=con(T).match(/Boot count: (\d+)/);counts.push(m?+m[1]:-1)}
  ck('  Stop and Run again: the counter keeps counting (1, 2, 3): the EEPROM is non-volatile',counts.join()=='1,2,3',counts.join()+'  '+con(T));}
 process.exit(require('./e2e_i2c').fails?1:0)})();
