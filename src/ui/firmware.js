// ---------- firmware loading & build
function b64(s){const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}
const image=()=>new Uint8Array(BRD.flashSize).fill(0xFF);
function parseFw(b){const im=image();const dv=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(b[0]==0x7f&&b[1]==0x45&&b[2]==0x4c&&b[3]==0x46){const ph=dv.getUint32(0x1C,true),es=dv.getUint16(0x2A,true),n=dv.getUint16(0x2C,true);for(let k=0;k<n;k++){const o=ph+k*es;if(dv.getUint32(o,true)!=1)continue;const off=dv.getUint32(o+4,true),pa=dv.getUint32(o+12,true),fs=dv.getUint32(o+16,true);if(pa>=BRD.flashBase&&pa+fs<=BRD.flashBase+BRD.flashSize)im.set(b.subarray(off,off+fs),pa-BRD.flashBase)}}
 else if(b[0]==0x3A){const t=new TextDecoder().decode(b);let bs=0;for(const ln of t.split(/\r?\n/)){if(ln[0]!=':')continue;const len=parseInt(ln.substr(1,2),16),ad=parseInt(ln.substr(3,4),16),ty=parseInt(ln.substr(7,2),16);if(ty==4)bs=parseInt(ln.substr(9,4),16)*65536;else if(ty==0)for(let i=0;i<len;i++){const a=bs+ad+i-BRD.flashBase;if(a>=0&&a<BRD.flashSize)im[a]=parseInt(ln.substr(9+i*2,2),16)}}}
 else im.set(b.subarray(0,BRD.flashSize));
 if(im.every(x=>x==0xFF))throw Error('no data in the Flash range 0x'+BRD.flashBase.toString(16).padStart(8,'0')+' to 0x'+(BRD.flashBase+BRD.flashSize-1).toString(16).padStart(8,'0'));
 if(BRD.patchLoad&&BRD.patchLoad(im))log('Boot checksum written into the vector table (an ISP tool does this when programming a real LPC chip).');return im}
const API=(window.PINFORGE_API||'')+'/api';
async function doBuild(){if(!CAN||building||!FW||FW.src==null)return;building=true;chips();setDock('build');blog('Compiling main.c with arm-none-eabi-gcc (-Os)…',true);
 try{const r=await fetch(API+'/compile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:FW.src,opt:'Os',target:BRD.target})}),j=await r.json();
  if(j.log)blog(j.log);
  if(!j.ok){blog('\nBuild failed.');$('chipBuild').className='chip err';$('chipBuild').textContent='Build failed';building=false;chips();$('chipBuild').className='chip err';$('chipBuild').textContent='Build failed';return}
  const im=image();im.set(b64(j.bin));FW.bytes=im;FW.dirty=false;FW.info={size:j.size,text:j.text,data:j.data,bss:j.bss};blog('\nBuild OK: '+j.size+' bytes (text '+j.text+', data '+j.data+', bss '+j.bss+')'+(run?'\nStop and press Run to load the new build.':''))}
 catch(e){blog('Build failed: could not reach the compile server ('+e.message+')')}
 building=false;chips()}
function doRun(){audioEnsure();if(run||building||!FW||!FW.bytes)return;if(FW.dirty){blog('Source changed since the last build — press Build first.',false);setDock('build');chips();return}bootFw()}
function initS(){S={};BN.forEach(b=>{if(BRD.gpio.test(b.l))S[b.l]={m:'INPUT',o:0,pw:null}})}
function refreshLV(){const f=netf();for(let p=0;p<BRD.ports;p++)for(let i=0;i<BRD.npins;i++){const n=pn(p,i);if(!S[n]){LV[p][i]=0;continue}const o=sense(f,BID+':'+n);LV[p][i]=o.lo?0:o.hi?1:o.an!=null?(o.an>2047?1:0):2}lvv=ver}
const simNow=()=>M?simT+(M.cy-tickC0)/tickClk:simT;
const HOST={
 gpio(p,i,q){const s=S[pn(p,i)];if(!s)return;let m='INPUT',o=q.odr;if(q.mode){if(q.cnf&1){if(q.odr)m='INPUT';else{m='OUTPUT';o=0}}else m='OUTPUT'}else if(q.cnf==2)m=q.odr?'INPUT_PULLUP':'INPUT';
  s.m=m;s.o=o;s.af=!!(q.mode&&q.cnf>=2);s.od=!!(q.mode&&q.cnf==3);if(s.od){s.m='OUTPUT';s.o=1}s.pd=!q.mode&&q.cnf==2&&!q.odr;if(m!='OUTPUT')s.pw=null;ver++;laSample();devStep(simNow());rdraw()},
 pwm(p,i,d){const n=pn(p,i),s=S[n];if(!s)return;s.pw=d;if(d===null){delete PWMON[n];s.pl=null}ver++;rdraw()},
 pwmEdge(p,i,v){const n=pn(p,i);PWMON[n]=1;if(S[n])S[n].pl=v;laRec(n,simNow(),v);ver++;devStep(simNow())},
 uartTx(k,c,brr){const n=UTX[k];if(!M||!brr||!S[n])return;const bit=brr/M.sysclk(),t=Math.max(simNow(),txEnd[k]);UARTON[n]=1;laRec(n,Math.max(0,t-bit),1);laRec(n,t,0);for(let b=0;b<8;b++)laRec(n,t+(1+b)*bit,(c>>b)&1);laRec(n,t+9*bit,1);txEnd[k]=t+10*bit},
 readPin(p,i,cnf,odr){if(lvv!==ver||(DRVP&&(M.cy>>9)!==drvC)){drvC=M.cy>>9;if(DRVP)NCv=-1;refreshLV()}const v=LV[p][i];return v==2?(cnf==2?odr:0):v},
 analog(ch){const n=BRD.adcPin(ch);return n?aread(n):0},
 serial(k,c){if(c==13)return;sbuf+=String.fromCharCode(c)}};
function fwTick(){if(!M||!run)return;const w0=performance.now(),clk=M.sysclk(),want=clk*0.01;tickC0=M.cy;tickClk=clk;let n=0;M.setPin();
 while(M.cy-tickC0<want&&!M.halted){M.step();if(!(++n&1023)){M.setPin();if(performance.now()-w0>8)break}}
 const dc=M.cy-tickC0;simT+=dc/clk;tickC0=M.cy;devStep(simT);spd=spd*.9+0.1*Math.min(1,(dc/clk)/0.01);
 if(sbuf){const c=$('con');c.textContent+=sbuf;sbuf='';c.scrollTop=1e9}
 if(M.halted){log('CPU halted: '+M.halted);stopSim()}}
function bootFw(){initS();devReset();$('con').textContent='';rx='';sbuf='';LA={};PWMON={};UARTON={};txEnd=[0,0,0];LAalias={};I2CON={};LANAME={};I2CLOG.length=0;I2CDGL.length=0;I2CLS[0]={};I2CLS[1]={};I2CSEL=[null,null];I2CC={};I2CDG={};DRVP=parts.some(p=>I2CD[p.type]&&I2CD[p.type].drive);i2cMonLast='';
 M=BRD.create(HOST);M.load(FW.bytes,BRD.flashBase);const sp=M.rd32(BRD.flashBase),rv=M.rd32(BRD.flashBase+4);
 if(!BRD.vecOk(sp,rv)){log('Invalid firmware: bad vector table (SP=0x'+sp.toString(16)+', reset=0x'+rv.toString(16)+')');M=null;return}
 simT=0;tickC0=0;spd=1;sel=sel&&sel.k=='p'?sel:null;run=true;M.reset();tickC0=M.cy;laSample();fwTimer=setInterval(fwTick,10);log('Running '+FW.name);setDock(dockT=='build'?'serial':dockT);chips();draw()}
function stopSim(){if(!run&&!M)return;clearInterval(fwTimer);run=false;M=null;pend=null;Object.keys(S).forEach(p=>S[p]={m:'INPUT',o:0,pw:null});chips();draw()}
$('bBuild').onclick=doBuild;$('bRun').onclick=doRun;$('bStop').onclick=()=>{if(run){stopSim();log('Simulation stopped.')}};
function setFw(f){if(run)stopSim();FW=f;if(fileTab=='c')showFile('c');chips();$('stFlash').textContent='Flash '+(f.info?f.info.size:f.used||'–')+' / '+BRD.flashSize+' B'}
fillEx();
$('ex').onchange=()=>{const e=EXS[+$('ex').value];if(!e)return;if(e.circuit&&!run)applyCircuit(e.circuit);setFw({name:e.id+'.bin',bytes:b64(e.b64),src:e.src,dirty:false,used:b64(e.b64).length});blog('Prebuilt example — press Run, or edit and Build.',true)};
$('ld').onclick=()=>$('fl').click();
$('fl').onchange=async ev=>{const f=ev.target.files[0];if(!f)return;try{const im=parseFw(new Uint8Array(await f.arrayBuffer()));const o=document.createElement('option');o.textContent='Loaded: '+f.name;o.value='file';$('ex').appendChild(o);$('ex').selectedIndex=$('ex').options.length-1;setFw({name:f.name,bytes:im,src:null,dirty:false,used:im.lastIndexOf?(()=>{let n=65536;while(n>0&&im[n-1]==0xFF)n--;return n})():0})}catch(e){blog('Could not load '+f.name+': '+e.message,true);setDock('build')}ev.target.value=''};
