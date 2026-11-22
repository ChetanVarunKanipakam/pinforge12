// ---------- tabs & layout
function setView(v){view=v;$('work').dataset.v=v;document.querySelectorAll('#views .tb').forEach(b=>b.classList.toggle('a',b.dataset.v==v));setTimeout(()=>{laDraw()},30)}
document.querySelectorAll('#views .tb').forEach(b=>b.onclick=()=>setView(b.dataset.v));addEventListener('resize',()=>setView(view));
function setDock(d){document.querySelectorAll('#dtabs .tb[data-d]').forEach(b=>b.classList.toggle('a',b.dataset.d==d));document.querySelectorAll('.dpane').forEach(p=>p.classList.toggle('a',p.id=='p-'+d));$('dock').classList.remove('min');dockT=d;if(d=='logic')setTimeout(laDraw,30);regsDraw();i2cMonDraw()}
let dockT='serial';document.querySelectorAll('#dtabs .tb[data-d]').forEach(b=>b.onclick=()=>setDock(b.dataset.d));
$('dmin').onclick=()=>{$('dock').classList.toggle('min');$('dmin').innerHTML=$('dock').classList.contains('min')?'&#9652;':'&#9662;';setTimeout(laDraw,30)};
// ---------- status / chips
function chips(){const m=$('chipMode'),b=$('chipBuild');m.className='chip'+(run?' run':'');m.textContent=run?'Running · circuit locked':'Edit mode';
 let t='Ready',c='chip';if(building){t='Building…';c='chip warn'}else if(FW&&FW.dirty){t='Source changed — press Build';c='chip warn'}else if(FW&&FW.info){t='Built · '+FW.info.size+' B';c='chip ok'}else if(FW&&FW.src==null){t='Binary loaded';c='chip ok'}
 b.className=c;b.textContent=t;$('circPane').classList.toggle('locked',run);$('plus').disabled=run;$('plus').title=run?'Circuit is locked while running — press Stop to add parts':'Add a part';
 $('bBuild').disabled=building||!CAN||(FW&&FW.src==null);$('bBuild').title=CAN?'Compile main.c (Ctrl+B)':'Needs the hosted compile server';$('bRun').disabled=run||building;$('bStop').disabled=!run;
 $('stRun').textContent=run?'Running':'Stopped';$('stFlash').textContent=FW&&FW.bytes?'Flash '+(FW.info?FW.info.size:FW.used||'–')+' / '+BRD.flashSize+' B':'Flash –';$('code').readOnly=!codeEditable();$('ex').disabled=run;$('brd').disabled=run;$('ld').disabled=run;noteUpdate();barKey='';bar()}
// ---------- build log / serial
const log=t=>{const c=$('con');c.textContent+=t+'\n';c.scrollTop=1e9};
const blog=(t,reset)=>{const b=$('blog');b.textContent=(reset?'':b.textContent+'\n')+t};
function sendSerial(){const v=$('si').value;if(!v)return;rx+=v+'\n';$('si').value='';if(M&&run){for(const ch of v+'\n')M.rxByte(0,ch.charCodeAt(0));log('> '+v)}}
$('sb').onclick=sendSerial;$('si').addEventListener('keydown',e=>{if(e.key=='Enter')sendSerial()});
