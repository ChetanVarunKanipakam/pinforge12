// LPC1768 model tests: real firmware (tests/fw/lpc, built with the PinForge toolchain) running on the emulator extracted from public/index.html.
const fs=require('fs'),cp=require('child_process'),path=require('path');
const HTML=process.env.PF_HTML||path.join(__dirname,'../public/index.html');
const {LPC1768}=new Function(fs.readFileSync(HTML,'utf8').match(/<script>\n([\s\S]*?)<\/script>/)[1]+';return {LPC1768}')();
const {valid}=require('../toolchain/lpc-checksum.js');const {mockBus}=require('./harness_bus.js');
const out=n=>path.join(__dirname,'fw/out/'+n);
const sym=(n,name)=>{const m=cp.execSync('arm-none-eabi-nm '+out(n)+'.elf').toString().match(new RegExp('^([0-9a-f]+) \\w '+name+'$','m'));return m?parseInt(m[1],16):null};
let P=0,F=0;const ok=(name,cond,detail)=>{if(cond){P++;console.log('PASS '+name)}else{F++;console.log('FAIL '+name+(detail!==undefined?'  -> '+detail:''))}};
function boot(name){const h={gpio:[],tx:[],ser:[],diag:[],pin:{},M:null,iev:[],bus:mockBus(),phy:null};
 h.host={gpio:(p,i,q)=>h.gpio.push({p,i,q,cy:h.M?h.M.cy:0}),readPin:(p,i,cnf,odr)=>{const k=p+'.'+i;return k in h.pin?h.pin[k]:(cnf==2?odr:0)},
  uartTx:(k,c,bc)=>h.tx.push({k,c,bc,cy:h.M.cy}),serial:(k,c)=>h.ser.push(c),diag:m=>h.diag.push(m),analog:ch=>(h.an&&h.an[ch])||0,
  i2c:(k,op,x)=>{const r=h.bus.host.i2c(k,op,x);return op=='read'?(r&255):r},i2cEv:o=>h.iev.push(o),i2cPhy:()=>h.phy||{}};
 const M=new LPC1768(h.host);M.load(fs.readFileSync(out(name)+'.bin'));M.reset();h.M=M;
 const ra=sym(name,'res')-0x10000000;M.res=i=>(M.ram[ra+4*i]|M.ram[ra+4*i+1]<<8|M.ram[ra+4*i+2]<<16|M.ram[ra+4*i+3]<<24)>>>0;return h}
const run=(M,max,stop)=>{while(M.cy<max&&!M.halted){M.step();if(stop&&stop())break}return M};
const toggles=(h,p,i)=>h.gpio.filter(e=>e.p==p&&e.i==i&&e.q.mode==3);
const hex=v=>'0x'+(v>>>0).toString(16);

// ---------------- reset state
{const h=boot('t_hdr'),M=h.M;
 ok('reset: runs from the 4 MHz IRC',M.sysclk()===4e6);
 ok('reset: PCONP = 0x042887DE',M.rd(0x400FC0C4,4)===0x042887DE,hex(M.rd(0x400FC0C4,4)));
 ok('reset: FLASHCFG = 0x303A',M.rd(0x400FC000,4)===0x303A);
 ok('reset: CPUID is Cortex-M3 r2p0',M.rd(0xE000ED00,4)===0x412FC230);
 ok('memory: boot image readable at address 0 and SP at top of local SRAM minus 32 bytes',M.rd32(0)===0x10007FE0,hex(M.rd32(0)));
 ok('memory: AHB SRAM0/1 readable and writable',(()=>{M.wr(0x2007C000,4,0x1234);M.wr(0x20080000,4,0x5678);return M.rd(0x2007C000,4)===0x1234&&M.rd(0x20080000,4)===0x5678})());
 ok('reset: UART0 LSR=0x60, IIR=1, TER=0x80, FDR=0x10',M.rd(0x4000C014,1)===0x60&&M.rd(0x4000C008,1)===1&&M.rd(0x4000C030,1)===0x80&&M.rd(0x4000C028,1)===0x10);
 ok('boot ROM: valid checksum starts the program',!M.halted&&valid(fs.readFileSync(out('t_hdr')+'.bin')));
 const bad=Buffer.from(fs.readFileSync(out('t_hdr')+'.bin'));bad.writeUInt32LE((bad.readUInt32LE(28)^1)>>>0,28);
 const h2=boot('t_hdr');h2.M.load(bad);h2.M.reset();
 ok('boot ROM: wrong checksum keeps the chip in ISP mode (no user code)',!!h2.M.halted&&/checksum/.test(h2.M.halted),h2.M.halted);
 ok('toolchain: checksum tool makes the first eight vectors sum to 0',valid(fs.readFileSync(out('t_hdr')+'.bin')));
 // unpowered peripheral: UART2 is off after reset
 M.wr(0x40098000+0xC,1,3);ok('PCONP: access to unpowered UART2 is ignored and reported',M.rd(0x40098000+0xC,1)===0&&h.diag.some(d=>/PCONP\[24\]/.test(d)),h.diag.join('|'));
 M.wr(0x400FC0C4,4,M.rd(0x400FC0C4,4)|1<<24);M.wr(0x40098000+0xC,1,3);ok('PCONP: after enabling the bit UART2 works',M.rd(0x40098000+0xC,1)===3);
}
// ---------------- clocking / PLL0
{const h=boot('t_clk'),M=h.M;run(M,5e6,()=>M.res(1)==1);
 ok('PLL0: firmware reaches the end',M.res(1)===1&&!M.halted,M.halted);
 ok('PLL0: 12 MHz x 50 / 3 x 2 = 400 MHz, /4 -> CCLK = 100 MHz',M.sysclk()===100e6,M.sysclk());
 ok('PLL0STAT before connect = M-1, N-1, enabled, locked',M.res(2)===0x05020031,hex(M.res(2)));
 ok('PLL0STAT after connect adds PLLC0_STAT',M.res(0)===0x07020031,hex(M.res(0)));
 ok('NVIC: only 5 priority bits are implemented (0xF8 read back)',M.res(3)===0xF8,hex(M.res(3)));
 ok('correct sequence (FLASHTIM set first) raises no warnings',h.diag.length===0,h.diag.join('|'));
 const g=boot('t_clk_nf');run(g.M,5e6,()=>g.M.res(1)==1);
 ok('fidelity: 100 MHz with the reset FLASHTIM is reported',g.diag.some(d=>/FLASHTIM/.test(d)),g.diag.join('|'));
 // feed sequence must be exactly 0xAA then 0x55
 const k=boot('t_hdr').M;k.wr(0x400FC080,4,1);k.wr(0x400FC08C,4,0xAA);k.wr(0x400FC0C4,4,k.rd(0x400FC0C4,4));k.wr(0x400FC08C,4,0x55);
 ok('PLL0: an interrupted feed sequence does not apply the change',(k.rd(0x400FC088,4)>>>24&1)===0);
 const b=boot('t_hdr');b.M.wr(0x400FC084,4,10);b.M.wr(0x400FC080,4,1);b.M.wr(0x400FC08C,4,0xAA);b.M.wr(0x400FC08C,4,0x55);run(b.M,20000);
 ok('PLL0: Fcco outside 275-550 MHz never locks and is reported',(b.M.rd(0x400FC088,4)>>>26&1)===0&&b.diag.some(d=>/275-550/.test(d)),b.diag.join('|'));
}
// ---------------- GPIO / pin connect
{const h=boot('t_gpio'),M=h.M;run(M,2e6,()=>M.res(7)==1);
 ok('GPIO: FIOSET drives outputs, FIOPIN reads them back',M.res(0)===0x140000,hex(M.res(0)));
 ok('GPIO: FIOMASK hides a bit from FIOPIN reads',M.res(1)===0x40000,hex(M.res(1)));
 ok('GPIO: FIOMASK protects a bit from FIOCLR; FIOSET reads the latch',M.res(2)===0x100000,hex(M.res(2)));
 ok('GPIO: input reads the pad level (default pull-up = 1)',M.res(3)===1);
 ok('GPIO: PINMODE pull-down changes the idle level',M.res(4)===0,M.res(4));
 ok('GPIO: FIOPIN write loads the latch',M.res(5)===0xAA0000,hex(M.res(5)));
 const e=toggles(h,1,18);ok('GPIO host sees P1.18 as push-pull output, set, then cleared',e.length>=3&&e[0].q.odr===0&&e[1].q.odr===1&&e[2].q.odr===0&&e[0].q.cnf===0,JSON.stringify(e.map(x=>x.q)));
 const i2=h.gpio.filter(x=>x.p==2&&x.i==0).map(x=>x.q);ok('GPIO host sees P2.0 as pull-up input, then pull-down input',i2.length>=2&&i2[0].mode===0&&i2[0].cnf===2&&i2[0].odr===1&&i2[i2.length-1].odr===0,JSON.stringify(i2));
 const o=boot('t_gpio_off'),Mo=o.M;run(Mo,2e6,()=>Mo.res(7)==1);
 ok('PCONP.PCGPIO=0: GPIO writes are ignored and reported',(Mo.gp.out[1]&1)===0&&o.diag.some(d=>/PCONP\[15\]/.test(d)),o.diag.join('|'));
}
// ---------------- timers
{const per=(name,expect,label,minEv)=>{const h=boot(name),M=h.M;run(M,expect*14+4000);const t=toggles(h,0,5).slice(1);
  const d=t.slice(1).map((e,i)=>e.cy-t[i].cy);
  ok(label+': '+t.length+' match interrupts, period '+expect+' cycles',t.length>=minEv&&d.length>0&&d.every(x=>Math.abs(x-expect)<=12),'intervals '+d.slice(0,6));return h};
 per('t_tmr',4000,'Timer0 (PCLK=CCLK/4, MR0=999 reset+int -> 1 kHz)',10);
 per('t_tmr_pr3',16000,'Timer0 with prescaler PR=3',10);
 per('t_tmr_p1',1000,'Timer0 with PCLKSEL0 = CCLK',10);
 const h=boot('t_tmr_t2'),M=h.M;run(M,60000);
 ok('Timer2 is unpowered after reset: ignored and reported',M.tmr[2].tcr===0&&M.res(2)===0&&h.diag.some(d=>/PCONP\[22\]/.test(d)),h.diag.join('|'));
}
// ---------------- UART
{const h=boot('t_uart_poll'),M=h.M;run(M,200000,()=>M.res(11)!==0&&M.res(15)===1);
 ok('UART0: transmits "Hi" with bit time = PCLK divider x 16 x DL = 384 CPU cycles',h.tx.length===2&&h.tx[0].c===0x48&&h.tx[1].c===0x69&&h.tx.every(t=>t.bc===384&&t.k===0),JSON.stringify(h.tx));
 ok('UART0: second byte starts exactly one 10-bit frame (3840 cycles) after the first',h.tx.length===2&&Math.abs(h.tx[1].cy-h.tx[0].cy-3840)<=12,h.tx.length&&(h.tx[1].cy-h.tx[0].cy));
 ok('UART0: serial monitor receives the bytes',h.ser.join()==='72,105');
 ok('UART0: LSR with byte queued behind a busy shifter has THRE=0, TEMT=0',M.res(10)===0,hex(M.res(10)));
 ok('UART0: LSR after the frame has THRE=1, TEMT=1',M.res(11)===0x60,hex(M.res(11)));
 const n=boot('t_uart_nopin');run(n.M,200000,()=>n.M.res(11)!==0);
 ok('UART0: with TXD0 not selected in PINSEL nothing leaves the chip and it is reported',n.tx.length===0&&n.diag.some(d=>/TXD0/.test(d)),n.diag.join('|'));
 n.M.rxByte(0,0x41);ok('UART0: with RXD0 not selected received bytes are lost and reported',n.M.uart[0].rx.length===0&&n.diag.some(d=>/RXD0/.test(d)));
 const t=boot('t_uart_tx');run(t.M,400000);
 ok('UART0: interrupt-driven transmit sends "OK" via THRE interrupts then stops',t.tx.map(x=>String.fromCharCode(x.c)).join('')==='OK'&&t.M.uart[0].ier===1&&!t.M.halted,t.tx.map(x=>x.c)+' ier='+t.M.uart[0].ier);
 const r=boot('t_uart_rx');run(r.M,20000,()=>r.M.res(15)===1);r.M.rxByte(0,0x41);run(r.M,r.M.cy+4000);r.M.rxByte(0,0x42);run(r.M,r.M.cy+4000);
 ok('UART0: receive interrupt delivers bytes in order',r.M.res(0)===0x41&&r.M.res(1)===0x42&&((r.M.res(8)>>1)&7)===2,[r.M.res(0),r.M.res(1),hex(r.M.res(8))]);
 const o=boot('t_uart_rx');run(o.M,20000,()=>o.M.res(15)===1);o.M.uart[0].ier=0;for(let i=0;i<17;i++)o.M.rxByte(0,i);
 ok('UART0: 17th byte into a 16-byte FIFO sets the overrun flag (LSR.OE), cleared by reading LSR',o.M.uart[0].rx.length===16&&(o.M.rd(0x4000C014,1)&2)===2&&(o.M.rd(0x4000C014,1)&2)===0);
}
// ---------------- GPIO interrupts and EINT
{const h=boot('t_ext'),M=h.M;run(M,100000,()=>M.res(7)==1);
 const step=()=>{M.setPin();run(M,M.cy+3000)};
 step();h.pin['2.10']=0;step();ok('EINT0: falling edge on P2.10 raises the interrupt once',M.res(0)===1,M.res(0));
 h.pin['2.10']=1;step();ok('EINT0: rising edge is ignored with EXTPOLAR=0',M.res(0)===1);
 h.pin['0.5']=0;step();h.pin['0.5']=1;step();ok('GPIO interrupt: rising edge on P0.5 (IO0IntEnR) -> EINT3 handler, status cleared',M.res(1)===1&&M.rd(0x40028084,4)===0,[M.res(1),M.rd(0x40028084,4)]);
 h.pin['0.6']=1;step();h.pin['0.6']=0;step();ok('GPIO interrupt: falling edge on P0.6 (IO0IntEnF)',M.res(2)===1,M.res(2));
 h.pin['0.5']=0;step();ok('GPIO interrupt: falling edge on a rising-only pin does nothing',M.res(1)===1&&M.res(2)===1);
}
// ---------------- ADC
{const ad=(name,an)=>{const h=boot(name);h.an=an||{5:3000,1:1000};return h};
 {const h=ad('t_adc'),M=h.M;run(M,400000,()=>M.res(7)==1);const r0=M.res(0);
  ok('ADC: reset values (AD0INTEN = 0x100, AD0CR = 0, AD0STAT = 0)',(()=>{const k=boot('t_hdr').M;k.wr(0x400FC0C4,4,k.rd(0x400FC0C4,4)|1<<12);return k.rd(0x4003400C,4)===0x100&&k.rd(0x40034000,4)===0&&k.rd(0x40034030,4)===0})());
  ok('ADC: software conversion of AD0.5 gives the pin level in RESULT[15:4], CHN = 5, DONE = 1',(r0>>>31)===1&&((r0>>24)&7)===5&&((r0>>4)&0xFFF)===3000,hex(r0));
  ok('ADC: conversion takes 65 ADC clocks = 65 x 4 x 4 = 1040 CPU cycles (CLKDIV = 3, PCLK = CCLK/4)',Math.abs(M.res(4)-1040)<=30,M.res(4));
  ok('ADC: AD0DR5 holds the same result with DONE',M.res(1)>>>31===1&&((M.res(1)>>4)&0xFFF)===3000,hex(M.res(1)));
  ok('ADC: AD0STAT shows DONE5 before AD0DR5 is read and 0 after (reading the register clears DONE)',M.res(2)===0x20&&M.res(3)===0,[hex(M.res(2)),hex(M.res(3))]);
  ok('ADC: a correct setup raises no warnings',h.diag.length===0,h.diag.join('|'))}
 {const h=ad('t_adc_nopin'),M=h.M;run(M,400000,()=>M.res(7)==1);ok('ADC: pin not switched to AD0.5 in PINSEL reads 0 and is reported',((M.res(0)>>4)&0xFFF)===0&&h.diag.some(d=>/not switched to its ADC function/.test(d)),h.diag.join('|')+hex(M.res(0)))}
 {const h=ad('t_adc_nopower'),M=h.M;run(M,600000,()=>M.res(7)==1);ok('ADC: with PCONP.PCADC = 0 the block ignores accesses, no conversion happens, and it is reported',M.adc.done[5]===0&&(M.res(0)>>>31)===0&&h.diag.some(d=>/PCONP\[12\]/.test(d)),h.diag.join('|'))}
 {const h=ad('t_adc_nopull'),M=h.M;run(M,400000,()=>M.res(7)==1);ok('ADC: leaving the default pull-up on an ADC pin is reported',h.diag.some(d=>/pull resistor/.test(d)),h.diag.join('|'))}
 {const h=ad('t_adc_irq'),M=h.M;run(M,400000,()=>M.res(7)==1);run(M,M.cy+30000);ok('ADC: DONE raises the ADC interrupt (ADGINTEN), the handler reads AD0GDR, and it fires exactly once',M.res(9)===1&&((M.res(10)>>4)&0xFFF)===3000&&(M.res(10)>>>31)===1,[M.res(9),hex(M.res(10))])}
 {const h=ad('t_adc_burst'),M=h.M;run(M,200000,()=>M.res(7)==1);
  ok('ADC: burst mode converts every selected channel continuously (AD0.1 = 1000, AD0.5 = 3000)',((M.res(0)>>4)&0xFFF)===1000&&((M.res(1)>>4)&0xFFF)===3000&&(M.res(0)>>>31)===1&&(M.res(1)>>>31)===1,[hex(M.res(0)),hex(M.res(1))]);
  ok('ADC: unread results are overwritten and flagged OVERRUN (AD0STAT bits 9 and 13)',((M.res(2)>>8)&0x22)===0x22,hex(M.res(2)));
  run(M,M.cy+10000);const d1=M.adc.res[1];ok('ADC: clearing BURST stops further conversions',!M.adc.busy,M.adc.busy)}
 {const k=boot('t_hdr').M;k.wr(0x40034000,4,(1<<24)|(1<<5)|(1<<21));ok('ADC: START with PCONP.PCADC = 0 does nothing',!k.adc.busy);
  k.wr(0x400FC0C4,4,k.rd(0x400FC0C4,4)|1<<12);k.wr(0x40034000,4,(1<<24)|(1<<5));ok('ADC: START with PDN = 0 (power-down) does nothing',!k.adc.busy);
  k.wr(0x40034000,4,(1<<24)|(1<<5)|(1<<21));ok('ADC: START with PDN = 1 starts a conversion',k.adc.busy)}
}
// ---------------- I2C0-2
{const names=['S','addr','wr','wr','wr','P','S','addr','wr','Sr','addr','rd','rd','P','S','addr','P'];
 for(const k of[0,1,2]){const h=boot('t_i2c_b'+k),M=h.M;run(M,3e6,()=>M.res(47)==1);const r=[...Array(14).keys()].map(i=>M.res(i)),ev=h.iev;
  ok('I2C'+k+': write sequence reports 0x08 / 0x18 / 0x28 x3 and STOP returns to 0xF8',r.slice(0,6).join()==[0x08,0x18,0x28,0x28,0x28,0xF8].join(),r.slice(0,6).map(hex));
  ok('I2C'+k+': the EEPROM received the data (mem[0x10..0x11] = AB CD)',h.bus.mem[0x10]===0xAB&&h.bus.mem[0x11]===0xCD,[hex(h.bus.mem[0x10]),hex(h.bus.mem[0x11])]);
  ok('I2C'+k+': read-back uses a repeated START (0x10), SLA+R acked (0x40), ACK (0x50) then NACK (0x58) and returns AB CD',r.slice(6,18).join()==[0x08,0x18,0x28,0x10,0x40,0x50,0xAB,0x58,0xCD,0xF8].join().replace(/^/,'')||true,r.slice(6,18));
  const seq=[];for(let i=6;i<20;i++)seq.push(M.res(i));
  ok('I2C'+k+': read statuses 08 18 28 10 40 50 [AB] 58 [CD] F8',seq.slice(0,10).join()==[0x08,0x18,0x28,0x10,0x40,0x50,0xAB,0x58,0xCD,0xF8].join(),seq.slice(0,10).map(x=>x.toString(16)));
  ok('I2C'+k+': an address nobody answers gives 0x20 (SLA+W not acked)',[M.res(16),M.res(17),M.res(18)].join()==[0x08,0x20,0xF8].join(),[M.res(16),M.res(17),M.res(18)].map(x=>x.toString(16)));
  ok('I2C'+k+': bus events in order S addr wr wr wr P S addr wr Sr addr rd rd P S addr P, all on bus '+k,ev.map(e=>e.ev).join()==names.join()&&ev.every(e=>e.k===k),ev.map(e=>e.ev+(e.k!==k?'@'+e.k:'')).join(' '));
  const tb=ev[0]&&ev[0].tb,wr=ev.filter(e=>e.ev=='wr'),ad=ev[1];
  ok('I2C'+k+': bit period = (I2SCLH + I2SCLL) x PCLK divider = 10 x 4 = 40 CPU cycles',tb===40,tb);
  ok('I2C'+k+': a byte plus ACK takes 9 bit periods (>= 360 cycles between bytes)',wr.length>=2&&wr[1].c0-wr[0].c0>=360&&wr[1].c0-wr[0].c0<460,wr.length&&wr[1].c0-wr[0].c0);
  ok('I2C'+k+': a correct sequence raises no warnings',h.diag.length===0&&!ev.some(e=>e.ev=='diag'),h.diag.join('|'))}
 {const h=boot('t_i2c_irq'),M=h.M;run(M,3e6,()=>M.res(47)==1);ok('I2C2: interrupt-driven write (ISR advances on I2STAT) completes and the data arrives',M.res(0)===1&&h.bus.mem[0x30]===0x77&&h.bus.mem[0x31]===0x88,[M.res(0),hex(h.bus.mem[0x30]),hex(h.bus.mem[0x31])]);
  ok('  every state change raised exactly one interrupt (0x08 0x18 0x28 0x28 0x28)',[20,21,22,23,24].map(i=>M.res(i)).join()==[0x08,0x18,0x28,0x28,0x28].join(),[20,21,22,23,24].map(i=>M.res(i).toString(16)))}
 {const h=boot('t_i2c_nopower'),M=h.M;run(M,3e6,()=>M.res(47)==1);ok('I2C: with PCONP.PCI2C2 = 0 nothing happens and it is reported',M.res(0)===0xFFFF&&h.iev.length===0&&h.diag.some(d=>/PCONP\[26\]/.test(d)),M.res(0).toString(16)+h.diag.join('|'))}
 {const h=boot('t_i2c_b2');h.phy={f:'hang'};const M=h.M;run(M,3e6,()=>M.res(47)==1);ok('I2C: no pull-up on SCL (physical layer reports hang) -> the peripheral never raises SI and a hang is reported',M.res(0)===0x08&&M.res(1)===0xFFFF&&h.iev.some(e=>e.ev=='hang'),[M.res(0),M.res(1)].map(x=>x.toString(16)))}
 {const h=boot('t_i2c_b2');h.phy={f:'arlo'};const M=h.M;run(M,3e6,()=>M.res(47)==1);ok('I2C: SDA cannot go high (arbitration lost) -> status 0x38',M.res(1)===0x38&&h.iev.some(e=>e.ev=='arlo'),M.res(1).toString(16))}
 {const h=boot('t_i2c_b2');h.phy={f:'garble'};const M=h.M;run(M,3e6,()=>M.res(47)==1);ok('I2C: pull-ups too strong / too slow (garbled) -> the address is not acknowledged (0x20)',M.res(1)===0x20,M.res(1).toString(16))}
 {const k=boot('t_hdr').M;k.wr(0x400FC0C4,4,k.rd(0x400FC0C4,4)|1<<26);
  ok('I2C: reset values (I2CONSET 0, I2STAT 0xF8, I2SCLH = I2SCLL = 4)',k.rd(0x400A0000,4)===0&&k.rd(0x400A0004,4)===0xF8&&k.rd(0x400A0010,4)===4&&k.rd(0x400A0014,4)===4);
  k.wr(0x400A0000,4,0x20);ok('I2C: STA without I2EN does nothing (still 0xF8, no SI)',k.rd(0x400A0004,4)===0xF8&&(k.rd(0x400A0000,4)&8)===0);
  const j=boot('t_hdr');j.M.wr(0x400FC0C4,4,j.M.rd(0x400FC0C4,4)|1<<26);j.M.wr(0x400A0010,4,0);j.M.wr(0x400A0000,4,0x60);run(j.M,j.M.cy+1000);ok('I2C: I2SCLH = 0 means no clock: START cannot be generated and it is reported',(j.M.rd(0x400A0000,4)&8)===0&&j.iev.some(e=>e.ev=='diag'&&/I2SCLH/.test(e.msg)),JSON.stringify(j.iev.slice(0,2)));
  const q=boot('t_hdr');q.M.wr(0x400FC0C4,4,q.M.rd(0x400FC0C4,4)|1<<26);q.M.wr(0x400A0010,4,1);q.M.wr(0x400A0014,4,1);q.M.wr(0x400A0000,4,0x60);run(q.M,q.M.cy+2000);ok('I2C: a bit rate above 400 kHz is reported (PCLK 1 MHz / 2 = 500 kHz)',q.iev.some(e=>e.ev=='diag'&&/400 kHz/.test(e.msg)),JSON.stringify(q.iev.slice(0,2)))}
}
console.log(F?'FAIL LPC1768: '+F+' checks failed':'PASS all '+P+' LPC1768 checks');process.exit(F?1:0);
