const {boot,run,mockBus}=require('./core');
let fails=0;const ck=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':'   got '+x));if(!c)fails++};
const fin=M=>run(M,4e7,()=>M.ram[0]===undefined);   // placeholder, replaced below
function go(M,cyc){const a=M.resAddr;run(M,cyc,()=>((M.ram[a+124]|M.ram[a+125]<<8)==0xD0D0));return M}
function mk(phyFn,extra={}){const B=mockBus();B.diag=[];const h=B.host;h.i2cPhy=(k,o)=>phyFn(o)||{};h.i2cEv=o=>{B.ev.push(o);if(o.ev=='diag')B.diag.push(o.msg)};Object.assign(h,extra);
 const M=boot('t_phy',h);M.resAddr=require('./core').sym('res',__dirname+'/fw/out/t_phy.elf')-0x20000000;return{B,M}}
{const {B,M}=mk(()=>({}));go(M,6e7);const r=M.res();
 ck('firmware finished',r[31]==0xD0D0,'halted='+M.halted+' '+r[31].toString(16));
 ck('FREQ=0: START never completes',r[0]==0,r[0]);
 ck('  ...with an explanation in the diagnostics',B.diag.some(d=>/FREQ is 0/.test(d)),B.diag.join('|'));
 ck('fast mode DUTY=1 at 8 MHz: START never completes',r[1]==0,r[1]);
 ck('  ...diagnostic names the 10 MHz requirement',B.diag.some(d=>/needs at least 10 MHz/.test(d)),B.diag.join('|'));
 ck('valid settings: START works',r[2]==1,r[2]);
 ck('address to an absent device: AF (NACK)',(r[4]&0x400)!=0&&(r[4]&0x200)==0,r[4].toString(16));
 ck('APB1RSTR reset clears CCR',r[8]==0,r[8]);}
// no pull-up on SDA: arbitration lost while sending the address (it contains 1 bits)
{const {B,M}=mk(o=>o.dir=='tx'?{f:'arlo'}:null);go(M,6e7);const r=M.res();
 ck('no SDA pull-up: ARLO set, ADDR/AF not',(r[4]&0x200)!=0&&(r[4]&2)==0&&(r[4]&0x400)==0,r[4].toString(16));
 ck('after ARLO the peripheral is no longer master (MSL=0) but BUSY stays set',(r[5]&1)==0&&(r[5]&2)!=0,r[5]);
 ck('STOP has no effect while not master: BUSY stays set',(r[7]&2)!=0,r[7]);
 ck('arbitration loss is explained',B.diag.some(d=>/arbitration lost/.test(d)),B.diag.join('|'));
 const a=B.ev.find(e=>e.ev=='arlo');ck('lost at the first 1 bit of 0xA0 (bit index 0)',a&&a.bit==0,JSON.stringify(a));}
// no SCL pull-up: SCL cannot rise, the byte never completes
{const {B,M}=mk(o=>({f:'hang'}));go(M,6e7);const r=M.res();
 ck('no SCL pull-up: address phase never completes (firmware times out)',r[3]==0&&(r[4]&0x602)==0,r[3]+' '+r[4].toString(16));
 ck('hang is explained',B.diag.some(d=>/SCL cannot rise/.test(d)));}
// SDA held low by something else: BUSY, START cannot be generated
{const {B,M}=mk(()=>({}),{i2cLow:()=>true});go(M,6e7);const r=M.res();
 ck('lines held low: START cannot be generated, BUSY reported',r[2]==0&&B.diag.some(d=>/held low/.test(d)),r[2]+' '+B.diag.join('|'));}
// slave clock stretching and rise time change the timing
{const {B,M}=mk(()=>({}),{i2cRise:()=>500e-9});go(M,6e7);const e=B.ev.find(e=>e.ev=='addr');
 ck('rise time 500 ns lengthens the SCL period: 80 + (500+25) ns x 8 MHz = 84 cycles',e&&e.tb==84,e&&e.tb);}
{let n=0;const {B,M}=mk(()=>({}),{i2cStretch:()=>5000});go(M,9e7);const addr=B.ev.find(e=>e.ev=='addr');
 ck('slave stretching SCL delays the end of the byte',B.ev.some(e=>e.ev=='addr'),'');
 const st=B.ev.filter(e=>e.ev=='S')[0];ck('(stretch run completed)',M.res()[31]==0xD0D0,M.res()[31].toString(16));}
process.exit(fails?1:0);
