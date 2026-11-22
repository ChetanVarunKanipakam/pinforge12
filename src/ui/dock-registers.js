// ---------- CPU registers tab
const hx=v=>'0x'+(v>>>0).toString(16).padStart(8,'0');
function regsDraw(){if(dockT!='regs')return;const el=$('regs');if(!M){el.textContent=run?'':'Not running. Press Run to see live CPU state.';return}const r=M.r;let t='';
 for(let i=0;i<13;i+=2)t+=('R'+i).padEnd(4)+hx(r[i])+(i<12?'   '+('R'+(i+1)).padEnd(4)+hx(r[i+1]):'')+'\n';
 t+='SP  '+hx(r[13])+'   LR  '+hx(r[14])+'\nPC  '+hx(r[15])+'   xPSR flags  N'+M.N+' Z'+M.Z+' C'+M.C+' V'+M.V+'   IPSR '+M.ipsr+'\n';
 t+='cycles '+M.cy+'   clock '+(M.sysclk()/1e6)+' MHz   SysTick '+(M.st.ctrl&1?'on':'off')+' load '+M.st.load+'\n\n';
 t+=BRD.id=='lpc1768'?lpcRegs():f1Regs();
 t+='\nNVIC enabled '+hx(M.nvEn[0])+' '+hx(M.nvEn[1])+'   pending '+hx(M.nvPend[0])+' '+hx(M.nvPend[1])+'   active '+(M.act.length?M.act.join(','):'none');el.textContent=t}
function f1Regs(){let t='';['A','B','C'].forEach((n,p)=>{const g=M.gp[p];t+='GPIO'+n+'  CRL '+hx(g.crl)+'  CRH '+hx(g.crh)+'  ODR 0x'+g.odr.toString(16).padStart(4,'0')+'  IDR 0x'+(()=>{let v=0;for(let i=0;i<16;i++)v|=M.pinIn(p,i)<<i;return v})().toString(16).padStart(4,'0')+((M.rcc.apb2&M.gate[p])?'':'   (clock off)')+'\n'});return t}
function lpcRegs(){const sc=M.sc;let t='SC    PCONP '+hx(sc.pconp)+'  PLL0STAT '+hx(M.rd(0x400FC088,4))+'  CCLKCFG '+sc.cclkcfg+'  FLASHCFG '+hx(sc.flashcfg)+'\n';
 for(let p=0;p<5;p++){let v=0;for(let i=0;i<32;i++)v|=M.pinIn(p,i)<<i;t+='FIO'+p+'  DIR '+hx(M.gp.dir[p])+'  PIN '+hx(v)+'  SET '+hx(M.gp.out[p])+'  MASK '+hx(M.gp.mask[p])+'\n'}
 M.tmr.forEach((x,k)=>{t+='TIMER'+k+'  TCR '+x.tcr+'  TC '+hx(x.tc)+'  PR '+x.pr+'  MCR '+x.mcr.toString(16)+'  IR '+x.ir.toString(16)+((sc.pconp>>[1,2,22,23][k])&1?'':'   (power off)')+'\n'});
 M.uart.forEach((u,k)=>{t+='UART'+k+'  LCR '+u.lcr.toString(16)+'  DL '+((u.dlm<<8)|u.dll)+'  IER '+u.ier.toString(16)+'  FIFO rx '+u.rx.length+((sc.pconp>>[3,4,24,25][k])&1?'':'   (power off)')+'\n'});return t}
