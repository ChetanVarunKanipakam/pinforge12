// Builds hw_validate.c with the PinForge toolchain, runs it on the simulated LPC1768 and writes the text it prints on UART0 to expected_sim.txt.
// usage: node tests/hw-validation/run-sim.js [-DTRY_UNPOWERED]
const fs=require('fs'),cp=require('child_process'),path=require('path');
const root=path.join(__dirname,'../..'),tc=path.join(root,'toolchain'),extra=process.argv.slice(2);
const elf='/tmp/hw_validate.elf',bin='/tmp/hw_validate.bin';
cp.execFileSync('arm-none-eabi-gcc',['-mcpu=cortex-m3','-mthumb','-Os','-Wall','-Wextra','-nostdlib','-ffreestanding','-ffunction-sections','-fdata-sections','-I',tc,'-T',path.join(tc,'lpc17xx.ld'),'-Wl,--gc-sections',...extra,path.join(tc,'lpc17xx_startup.c'),path.join(__dirname,'hw_validate.c'),'-o',elf,'-lgcc'],{stdio:'inherit'});
cp.execFileSync('arm-none-eabi-objcopy',['-O','binary',elf,bin]);cp.execFileSync('node',[path.join(tc,'lpc-checksum.js'),bin],{stdio:'ignore'});
fs.copyFileSync(bin,path.join(__dirname,'hw_validate.bin'));
const {LPC1768}=new Function(fs.readFileSync(path.join(root,'public/index.html'),'utf8').match(/<script>\n([\s\S]*?)<\/script>/)[1]+';return {LPC1768}')();
let text='';const diag=[];const M=new LPC1768({serial:(k,c)=>{if(k==0)text+=String.fromCharCode(c)},uartTx:()=>{},gpio:()=>{},readPin:(p,i,cnf,odr)=>cnf==2?odr:0,diag:m=>diag.push(m)});
M.load(fs.readFileSync(bin));M.reset();
while(M.cy<400e6&&!M.halted&&!/END\r\n$/.test(text))M.step();
if(M.halted){console.error('halted: '+M.halted);process.exit(1)}
if(!/END\r\n$/.test(text)){console.error('firmware did not finish; output so far:\n'+text);process.exit(1)}
fs.writeFileSync(path.join(__dirname,'expected_sim.txt'),text.replace(/\r/g,''));
process.stdout.write(text.replace(/\r/g,''));if(diag.length)console.log('\n[simulator warnings]\n'+diag.join('\n'));
