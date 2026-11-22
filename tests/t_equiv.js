// Differential test: frozen v1 emulator (tests/ref/cm3_ref.js) vs the modular one built into public/index.html.
// Both run the same firmware in lockstep with identical stimuli; every step compares CPU state, NVIC/SysTick and all host callbacks.
const fs=require('fs'),path=require('path');
const REF=require('./ref/cm3_ref.js');
const HTML=process.env.PF_HTML||path.join(__dirname,'../public/index.html');
const html=fs.readFileSync(HTML,'utf8');
const NEW=new Function(html.match(/<script>\n([\s\S]*?)<\/script>/)[1]+';return CM3')();
const {mockBus}=require('./harness_bus.js');
function mk(C){const log=[],B=mockBus(),h=B.host;let lvl=0;
 const host={gpio:(p,i,q)=>log.push('gpio '+p+i+JSON.stringify(q)),pwm:(p,i,d)=>log.push('pwm '+p+i+d),pwmEdge:(p,i,v)=>log.push('pe '+p+i+v),
  uartTx:(k,c,b)=>log.push('tx'+k+c+':'+b),serial:(k,c)=>log.push('ser'+k+c),analog:ch=>(ch*313+7)&0xFFF,
  readPin:(p,i,c,o)=>((p*7+i*3+(M_cy()>>11))&1),i2c:(k,op,x,hz)=>{const r=h.i2c(k,op,x);log.push('i2c'+k+op+x+':'+r);return r},i2cEv:o=>log.push('ev'+JSON.stringify(o))};
 let M;const M_cy=()=>M?M.cy:0;M=new C(host);
 // The one intentional behaviour change since the frozen reference: a level-sensitive interrupt is not re-pended while its own handler runs (it re-pends on exception return).
 // The oracle gets the same guard so that this test keeps proving that nothing else changed.
 if(C===REF){const oi=M.irq;M.irq=function(n){if(M.act.indexOf(16+n)>=0)return;return oi.call(M,n)}}
 return{M,log}}
function lock(name,bin,steps){const a=mk(REF),b=mk(NEW);for(const x of[a,b]){x.M.load(bin);x.M.reset()}
 for(let s=0;s<steps;s++){
  if(s%4000==3999){a.M.setPin();b.M.setPin()}
  if(s%30000==29999){a.M.rxByte(0,0x41+(s>>15&7));b.M.rxByte(0,0x41+(s>>15&7))}
  a.M.step();b.M.step();
  const A=a.M,B=b.M;
  const sa=[A.cy,A.halted,A.N,A.Z,A.C,A.V,A.ipsr,A.act.join(),A.nvEn.join(),A.nvPend.join(),A.st.val,A.st.flag,...A.r].join();
  const sb=[B.cy,B.halted,B.N,B.Z,B.C,B.V,B.ipsr,B.act.join(),B.nvEn.join(),B.nvPend.join(),B.st.val,B.st.flag,...B.r].join();
  if(sa!==sb)return name+': CPU state diverged at step '+s+'\n ref '+sa+'\n new '+sb;
  if(a.log.length!==b.log.length||(a.log.length&&a.log[a.log.length-1]!==b.log[b.log.length-1]))return name+': host callbacks diverged at step '+s+'\n ref '+a.log.slice(-2)+'\n new '+b.log.slice(-2);
  if(A.halted)break}
 if(a.log.join('\n')!==b.log.join('\n'))return name+': callback logs differ';
 const ram=(M)=>Buffer.from(M.ram).toString('hex');if(ram(a.M)!==ram(b.M))return name+': RAM differs';
 return {ok:1,log:a.log.length,cy:a.M.cy}}
let bins=[];const out=path.join(__dirname,'fw/out');
if(fs.existsSync(out))for(const f of fs.readdirSync(out))if(f.endsWith('.bin')){const b=fs.readFileSync(path.join(out,f));if(b.length>=4&&(b.readUInt32LE(0)>>>24)===0x20)bins.push([f,b])}   // STM32F103 images only (initial SP in 0x2000_0000 SRAM)
const exs=JSON.parse(html.match(/^const EXS=(\[.*\]);$/m)[1]);for(const e of exs.filter(e=>!e.board))bins.push(['ex:'+e.id,Buffer.from(e.b64,'base64')]);
let fail=0;for(const[n,bin]of bins){const r=lock(n,bin,300000);if(r.ok)console.log('PASS '+n+' ('+r.cy+' cycles, '+r.log+' host events identical)');else{fail++;console.log('FAIL '+r)}}
console.log(fail?'FAIL equivalence':'PASS all '+bins.length+' firmware images behave identically on the old and the new emulator');process.exit(fail?1:0)
