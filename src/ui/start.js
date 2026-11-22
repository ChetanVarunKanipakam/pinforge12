// ---------- start-up
const e0=EXS[0];FW={name:e0.id+'.bin',bytes:b64(e0.b64),src:e0.src,dirty:false,used:b64(e0.b64).length};
setCode(FW.src);setView(matchMedia('(max-width:900px)').matches?'circuit':'split');showFile('c');setDock('serial');initS();draw();chips();
fetch(API+'/health').then(r=>r.json()).then(j=>{if(j&&j.ok){CAN=true;chips();noteUpdate()}}).catch(()=>{});
