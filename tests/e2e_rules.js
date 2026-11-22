// Electrical and protocol rules a real bus enforces: pull-ups, rise time, drive strength, shorts, supply voltage, speed limits, logic levels, duplicate addresses.
const {sim,wires,part,ck}=require('./sens');
const V33='bluepill:3V3.2',V5='bluepill:5V',G='bluepill:GND.3';
const res=(id,val,a,b)=>({parts:[{id,type:'res',x:500,y:100,attrs:{value:String(val)}}],wires:[[id+':1',a,'green'],[id+':2',b,'red']]});
const ext=(val,v=V33,lines=['PB10','PB11'])=>{const o={parts:[],wires:[]};lines.forEach((l,i)=>{const r=res('r'+i,val,'bluepill:'+l,v);o.parts.push(...r.parts);o.wires.push(...r.wires)});return o};
const code=o=>{const m=o.match(/PROBE=(\d)/);return m?+m[1]:null};
const diag=(T,re)=>re.test(T.mon);
async function probe(oled,extra,vcc=V33,pins=[]){const e=extra||{parts:[],wires:[]};return sim('t_bus',[part('oled',oled)].concat(e.parts),wires('dev1',vcc,pins).concat(e.wires),{secs:2.5})}
(async()=>{
 let T=await probe({});
 ck('module with on-board pull-ups: address phase ACKed',code(T.out)==0,T.out);
 T=await probe({pullups:'off'});
 ck('no pull-up on SCL: SCL never rises, the peripheral hangs (firmware times out)',code(T.out)==2&&diag(T,/SCL cannot rise/),T.out+T.mon);
 T=await probe({pullups:'off'},ext(4700,V33,['PB10']));
 ck('pull-up on SCL only: SDA cannot go high, arbitration lost (ARLO) while sending the address',code(T.out)==3&&diag(T,/arbitration lost/),T.out+T.mon);
 T=await probe({pullups:'off'},ext(4700));
 ck('external 4.7k pull-ups on both lines work',code(T.out)==0,T.out+T.mon);
 T=await probe({pullups:'off'},ext(220));
 ck('220 ohm pull-ups: devices cannot pull the lines low (3 mA limit), transfers garbled',code(T.out)==1&&diag(T,/too strong/),T.out+T.mon);
 T=await probe({pullups:'off'},ext(100000));
 ck('100 kohm pull-ups: rise time far beyond 1 us, transfers garbled',code(T.out)==1&&diag(T,/rise time/),T.out+T.mon);
 T=await probe({pullups:'off'},ext(4700,V5));
 ck('pull-ups to 5 V work with 5 V tolerant pins and a 3-5.5 V OLED',code(T.out)==0,T.out+T.mon);
 T=await probe({},{parts:[],wires:[['bluepill:PB11',G,'black']]});
 ck('SDA shorted to GND: the bus is busy, START cannot be generated',code(T.out)==2&&diag(T,/held low/),T.out+T.mon);
 // supply voltage
 T=await sim('t_bmp',[part('bmp280',{})],wires('dev1',V5),{secs:3});
 ck('3.3 V-only BMP280 module on 5 V is destroyed (no answer, reported)',/ID=FF/.test(T.out)&&diag(T,/destroyed/),T.out+T.mon);
 T=await sim('t_bmp',[part('bmp280',{regulator:'yes'})],wires('dev1',V5),{secs:2});
 ck('  a module with an on-board regulator accepts 5 V',/ID=58/.test(T.out),T.out);
 T=await sim('t_bmp',[part('bmp280',{pullups:'off'})].concat(ext(4700,V5).parts),wires('dev1',V33).concat(ext(4700,V5).wires),{secs:3});
 ck('  pulling the bus up to 5 V damages the 3.3 V pins even with a good supply',/ID=FF/.test(T.out)&&diag(T,/tolerates at most 3.6 V/),T.out+T.mon);
 // speed and logic levels
 T=await sim('t_bus27_400',[part('lcdi2c',{})],wires('dev1',V5),{secs:2.5});
 ck('PCF8574 LCD backpack on a 400 kHz bus: not answering (100 kHz maximum)',code(T.out)==1&&diag(T,/supports at most 100 kHz/),T.out+T.mon);
 const T2=await sim('t_lcd',[part('lcdi2c',{pullups:'off'})].concat(ext(4700,V33).parts),wires('dev1',V5).concat(ext(4700,V33).wires),{secs:2.5});
 ck('5 V backpack on a bus pulled up to only 3.3 V: below its 0.7xVDD input level, it cannot see a 1',/RC=1/.test(T2.out)&&diag(T2,/below its 0.7xVDD/),T2.out+T2.mon);
 // several devices on one bus
 const multi=[part('oled',{},'oled1'),part('mpu6050',{},'mpu1'),part('bmp280',{},'bmp1')];
 const mw=[].concat(wires('oled1',V33),wires('mpu1',V33),wires('bmp1',V33)).filter((w,i,a)=>a.findIndex(x=>x[0]==w[0])==i);
 T=await sim('i2c_scan',multi,mw,{secs:3});
 ck('three modules on one bus: the scanner finds 0x3C, 0x68 and 0x76',/found device at 0x3C/.test(T.out)&&/found device at 0x68/.test(T.out)&&/found device at 0x76/.test(T.out),T.out);
 const dup=[part('oled',{},'oled1'),part('oled',{},'oled2')];
 T=await sim('t_bus',dup,[].concat(wires('oled1',V33),wires('oled2',V33)).filter((w,i,a)=>a.findIndex(x=>x[0]==w[0])==i).concat([['oled2:GND',G,'black'],['oled2:VCC',V33,'red'],['oled2:SCL','bluepill:PB10','green'],['oled2:SDA','bluepill:PB11','blue']]),{secs:2.5});
 ck('two devices with the same address: both answer, and the clash is reported',code(T.out)==0&&diag(T,/both answer at address 0x3C/),T.out+T.mon);
 process.exit(require('./sens').fails?1:0)})();
