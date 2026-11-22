// The LPC1768 board in the page, used the way a person would: switch board, run each example, press the button, load a binary.
const {load}=require('./harness');const fs=require('fs'),path=require('path');
let fails=0;const ck=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':'   got '+x));if(!c)fails++};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const J=(T,s)=>JSON.parse(T.ev('JSON.stringify('+s+')'));
const exIdx=(T,id)=>T.ev(`EXS.findIndex(e=>e.id=="${id}")`);
const pick=(T,id)=>T.ev(`$('ex').value=${exIdx(T,id)};$('ex').onchange()`);
const upto=(T,t)=>{for(let i=0;i<40000&&T.ev('simT')<t&&!T.ev('M.halted');i++)T.ev('fwTick()')};
const start=(T,id)=>{pick(T,id);T.ev('doRun()');T.ev('clearInterval(fwTimer)')};
const con=T=>T.ev('$("con").textContent');
(async()=>{
 const T=await load();
 // ---- board selector
 ck('starts on the Blue Pill with a two-board selector',T.ev('BRD.id')=='bluepill'&&T.ev('$("brd").options.length')==2&&T.ev('$("brd").value')=='bluepill');
 const bpEx=T.ev('$("ex").options.length');ck('Blue Pill keeps its own examples only (no LPC ones listed)',bpEx>=26&&!J(T,'[...$("ex").options].map(o=>o.textContent)').some(t=>/LPC1768/.test(t)),bpEx);
 T.ev('setBoard("lpc1768")');
 ck('switching board: LPC1768 is active with its own id, status line and serial name',T.ev('BRD.id')=='lpc1768'&&T.ev('BID')=='lpc1768'&&/LPC1768/.test(T.ev('$("stChip").textContent'))&&/UART0/.test(T.ev('$("si").placeholder')));
 ck('76 header pins (4 rows x 19) with unique ids; GND / 3V3 get .N suffixes',T.ev('BN.length')==76&&T.ev('new Set(BN.map(b=>b.id)).size')==76&&T.ev('BN.filter(b=>b.l=="GND").map(b=>b.id).join()')=='GND.1,GND.2,GND.3');
 ck('base() keeps P0.2 and strips only real duplicate suffixes',T.ev('base("P0.2")')=='P0.2'&&T.ev('base("GND.2")')=='GND'&&T.ev('base("3V3.3")')=='3V3'&&T.ev('base("P2.10")')=='P2.10');
 const g=J(T,'pinGeo("lpc1768:P2.0")'),g2=J(T,'pinGeo("lpc1768:P0.2")');
 ck('pin geometry is on the 20 px grid with outward wire directions',g.p[0]==80&&g.p[1]==300&&g.d[1]==1&&g2.p[0]==140&&g2.p[1]==60&&g2.d[1]==-1,JSON.stringify([g,g2]));
 ck('static board artwork is on the canvas, viewBox adapted',T.ev('$("cvb").innerHTML.length')>30000&&/LPC/.test(T.ev('$("cvb").innerHTML'))&&T.ev('cv.getAttribute("viewBox")')=='0 0 760 600');
 ck('pin tooltips list the alternate functions (P0.2 = TXD0 / AD0.7)',/P0\.2 · GPIO \/ TXD0 \/ AD0\.7/.test(T.ev('cv.innerHTML')));
 ck('examples list shows the six LPC examples; the first one is loaded with its circuit',J(T,'[...$("ex").options].map(o=>o.textContent)').length==6&&T.ev('FW.name')=='lpc_start.bin'&&T.ev('wires.length')==4&&T.ev('parts.length')==2);
 ck('flash size follows the board: a 512 KB image at address 0',T.ev('image().length')==524288&&T.ev('BRD.flashBase')==0);
 T.ev('$("q").value="";menu()');const menuTxt=T.ev('$("pl").textContent');
 ck('parts menu offers GPIO, ADC and I2C parts and hides only what the LPC1768 model cannot drive yet (servo)',/Potentiometer/.test(menuTxt)&&!/Servo/.test(menuTxt)&&/OLED|SSD1306/.test(menuTxt)&&/LED/.test(menuTxt)&&/Keypad/.test(menuTxt),menuTxt.slice(0,120));
 // ---- start-here example
 start(T,'lpc_start');upto(T,1.3);
 ck('lpc_start: runs on the LPC1768 model and prints its banner on UART0 (Serial Monitor)',/PinForge LPC1768: blink \+ button \+ UART0/.test(con(T))&&!T.ev('M.halted'),con(T)+T.ev('M.halted'));
 ck('  P2.0 is an output driven by the program; the LED part follows it',T.ev('S["P2.0"].m')=='OUTPUT'&&J(T,'[ledB(netf(),part("led1"))]')[0]>=0);
 const ledAt=t=>{upto(T,t);return J(T,'[ledB(netf(),part("led1"))]')[0]>0};
 const a=ledAt(1.3),b=ledAt(1.8),c=ledAt(2.3),d=ledAt(2.8);
 ck('  the LED blinks at 1 Hz in simulated time (500 ms on / 500 ms off)',a!==b&&b!==c&&c!==d,[a,b,c,d]);
 T.ev('part("btn1").down=true;ver++');upto(T,3.1);
 ck('  pressing the button prints the count on the serial console',/button pressed, count = 1/.test(con(T)),con(T).slice(-120));
 T.ev('part("btn1").down=false;ver++');upto(T,3.4);T.ev('part("btn1").down=true;ver++');upto(T,3.7);
 ck('  a second press counts again',/count = 2/.test(con(T)));
 ck('  the logic analyzer records the UART0 TXD pin (P0.2) and the LED pin',(J(T,'LA["P0.2"]||[]').length>20)&&(J(T,'LA["P2.0"]||[]').length>=3),JSON.stringify([J(T,'(LA["P0.2"]||[]).length'),J(T,'(LA["P2.0"]||[]).length')]));
 T.ev('dockT="regs"');T.ev('regsDraw()');const regs=T.ev('$("regs").textContent');
 ck('  the CPU Registers tab shows LPC state (PCONP, PLL0STAT, FIO ports, timers, UARTs)',/PCONP 0x042887de/.test(regs)&&/FIO2/.test(regs)&&/TIMER0/.test(regs)&&/UART0/.test(regs),regs.slice(0,200));
 T.ev('stopSim()');
 // ---- interrupts
 start(T,'lpc_irq');upto(T,1.7);
 ck('lpc_irq: Timer0 interrupt fires every 500 ms (3 ticks by 1.7 s)',/Timer0 tick 3\r?\n/.test(con(T))&&!/Timer0 tick 4/.test(con(T)),con(T));
 T.ev('part("btn1").down=true;ver++');upto(T,2.0);
 ck('  the button press raises the GPIO falling-edge interrupt (EINT3 vector) and the program counts it',/button interrupt, count = 1/.test(con(T)),con(T).slice(-90));
 T.ev('stopSim()');
 // ---- PLL
 start(T,'lpc_pll100');upto(T,1.2);
 ck('lpc_pll100: PLL0 locks and connects, CCLK = 100 MHz',T.ev('M.sysclk()')===100e6&&/CCLK = 100 MHz/.test(con(T)),con(T)+T.ev('M.sysclk()'));
 ck('  no simulator warnings: FLASHTIM was set before raising the clock',!/FLASHTIM|PLL0 is configured/.test(T.ev('$("con").textContent+$("blog").textContent')));
 ck('  simulated time stays consistent at 100 MHz (1 ms SysTick, 1 s ~ 1000 ms print)',/t = 500 ms/.test(con(T))&&/t = 1000 ms/.test(con(T)),con(T));
 T.ev('stopSim()');
 // ---- ADC
 start(T,'lpc_adc');upto(T,0.7);
 ck('lpc_adc: pot at mid scale reads 2048 (1650 mV) on AD0.5 and is printed on UART0',/AD0\.5 = 2048  \(1650 mV\)/.test(con(T)),con(T).slice(-80));
 T.ev('part("pot1").val=4095;ver++');upto(T,1.2);const c1=con(T);
 ck('  turning the pot to full scale reads 4095 and the LED (P2.0) lights above half scale',/AD0\.5 = 4095  \(3300 mV\)/.test(c1)&&T.ev('S["P2.0"].o')==1,c1.slice(-60));
 T.ev('part("pot1").val=0;ver++');upto(T,1.7);
 ck('  and back to 0 reads 0 with the LED off',/AD0\.5 = 0  \(0 mV\)/.test(con(T))&&T.ev('S["P2.0"].o')==0);
 ck('  ADC setup raises no warnings',!/PINSEL|PCONP|pull resistor/.test(T.ev('$("con").textContent+$("blog").textContent')));
 T.ev('stopSim()');
 // ---- I2C (AT24C32 EEPROM on I2C2)
 start(T,'lpc_i2c_eeprom');upto(T,0.5);const c0=con(T),mm=/write cycle took (\d+) ms, (\d+) ACK polls/.exec(c0);
 ck('lpc_i2c_eeprom: reads the EEPROM, increments the boot counter and writes it back (counter = 1 on a fresh chip)',/EEPROM boot counter = 1\b/.test(c0),c0);
 ck('  the ~5 ms write cycle is observed with ACK polling (status 0x20 until the chip answers again)',!!mm&&+mm[1]>=3&&+mm[1]<=8&&+mm[2]>=1,c0.slice(-90));
 ck('  SDA2 / SCL2 pins are alternate-function open-drain and the I2C monitor shows the transfers',T.ev('S["P0.10"].af&&S["P0.10"].od&&S["P0.11"].af')&&/I2C2/.test(T.ev('i2cMonText()')),T.ev('i2cMonText()').slice(0,160));
 T.ev('stopSim()');T.ev('doRun()');T.ev('clearInterval(fwTimer)');upto(T,0.5);
 ck('  Stop and Run again: the EEPROM kept its contents and the counter goes on (= 2)',/EEPROM boot counter = 2\b/.test(con(T)),con(T));
 T.ev('stopSim()');
 T.ev('parts=parts.filter(p=>p.type!="res");wires=wires.filter(w=>!/^r\d:/.test(w[0]));ver++;I2CC={};');T.ev('doRun()');T.ev('clearInterval(fwTimer)');upto(T,0.6);
 ck('  without the pull-up resistors the program reports a bus fault instead of hanging, and the I2C monitor explains why',/I2C bus fault/.test(con(T))&&T.ev('I2CDGL.some(d=>/pull-up/.test(d.msg))'),con(T)+T.ev('JSON.stringify(I2CDGL.map(d=>d.msg))'));
 T.ev('stopSim()');
 // ---- LED bar
 start(T,'lpc_knight');let sums=[];for(let k=1;k<=12;k++){upto(T,0.17*k);sums.push(T.ev('[...Array(10).keys()].reduce((n,i)=>n+(S["P2."+i]&&S["P2."+i].o?1:0),0)'))}
 ck('lpc_knight: exactly one of the ten bar LEDs is lit at any sampled time',sums.every(s=>s==1),sums);
 T.ev('stopSim()');
 // ---- diagram import/export, build target, load a binary
 const dg=J(T,'toDiagram()');ck('diagram.json export names the LPC board part',dg.parts[0].type=='board-lpc1768'&&dg.parts[0].id=='lpc1768'&&dg.connections.every(c=>/lpc1768:|^[a-z]+\d:/.test(c[0])));
 T.ev(`applyDiagram({parts:[{type:'board-lpc1768',id:'lpc1768'},{type:'wokwi-led',id:'l9',top:400,left:100,attrs:{}},{type:'board-ssd1306',id:'o9',top:400,left:300,attrs:{}}],connections:[['l9:A','lpc1768:P2.3','green'],['o9:SDA','lpc1768:P0.27','blue']]})`);
 ck('importing a diagram keeps the parts the LPC1768 can drive, including I2C parts',T.ev('parts.map(p=>p.id).join()')=='l9,o9'&&T.ev('wires.length')==2,T.ev('parts.map(p=>p.id).join()')+' wires='+T.ev('wires.length'));
 T.ev('window.__b=null;window.fetch=(u,o)=>{window.__b=o.body;return Promise.resolve({json:()=>Promise.resolve({ok:false,log:"stub"})})};CAN=true;FW.src="int main(void){return 0;}";FW.dirty=true;doBuild()');await sleep(50);
 ck('Build sends the LPC1768 target to the compile server',/"target":"lpc1768"/.test(T.ev('window.__b')),T.ev('window.__b'));
 const bin=Buffer.from(fs.readFileSync(path.join(__dirname,'fw/out/t_hdr.bin')));bin.writeUInt32LE((bin.readUInt32LE(28)^0x55)>>>0,28);
 const r=J(T,`(()=>{const im=parseFw(b64("${bin.toString('base64')}"));return[im.length,im[28]|im[29]<<8|im[30]<<16|im[31]<<24,im[0]|im[1]<<8|im[2]<<16|im[3]<<24]})()`);
 const want=Buffer.from(fs.readFileSync(path.join(__dirname,'fw/out/t_hdr.bin'))).readInt32LE(28);
 ck('Load...: an LPC binary gets its boot checksum fixed like an ISP tool does; image is 512 KB at address 0',r[0]==524288&&r[1]==want,JSON.stringify(r)+' want '+want);
 // ---- back to the Blue Pill
 T.ev('setBoard("bluepill")');
 ck('switching back: Blue Pill examples, pins and 64 KB flash are restored',T.ev('BRD.id')=='bluepill'&&T.ev('BN.length')==40&&T.ev('FW.name')=='hdr.bin'&&T.ev('$("cvb").innerHTML')==''&&T.ev('BN.some(b=>b.id=="GND.3")')&&T.ev('image().length')==65536);
 start(T,'hdr');upto(T,0.6);ck('  and its first example still runs and prints',T.ev('!M.halted')&&con(T).length>10,con(T));
 ck('no script errors in the page',T.errs.length==0,T.errs.join('|').slice(0,300));
 console.log(fails?'FAIL e2e_lpc_board: '+fails:'PASS all LPC1768 board checks');process.exit(fails?1:0);
})().catch(e=>{console.log('FAIL e2e_lpc_board crashed: '+e.stack);process.exit(1)});
