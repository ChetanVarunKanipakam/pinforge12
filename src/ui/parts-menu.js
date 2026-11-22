// ---------- parts menu (+)
function menu(){const q=$('q').value.toLowerCase();$('pl').innerHTML=CAT.filter(c=>partOk(c[0])&&(c[1]+c[2]).toLowerCase().includes(q)).map(c=>`<button data-add="${c[0]}">${c[1]}<span>${c[2]}</span></button>`).join('')||'<div style="padding:6px;color:var(--mu)">No parts found</div>'}
$('plus').onclick=e=>{e.stopPropagation();if(locked())return;$('pmenu').classList.toggle('on');$('q').value='';menu();$('q').focus()};
$('pmenu').addEventListener('click',e=>e.stopPropagation());$('q').addEventListener('input',menu);addEventListener('click',()=>$('pmenu').classList.remove('on'));
$('pl').addEventListener('click',e=>{const b=e.target.closest('[data-add]');if(!b||locked())return;const ty=b.dataset.add,id=ty+(++cnt);const pp=BRD.addPos?BRD.addPos(ty,cnt):DEVPOS[ty]||[380+(cnt%2)*40,80+(cnt%5)*80];parts.push({id,type:ty,x:pp[0],y:pp[1],rot:0,val:2048,pos:0,kdown:[],attrs:defAttrs(ty)});sel={k:'p',id};$('pmenu').classList.remove('on');draw()});
