// ---------- board selector and examples per board
function fillEx(){const s=$('ex');s.innerHTML='';EXS.forEach((e,i)=>{if((e.board||'bluepill')!=BRD.id)return;const o=document.createElement('option');o.value=i;o.textContent=e.title;s.appendChild(o)})}
function setBoard(id){const b=BOARDS[id];if(!b||b===BRD)return;if(run)stopSim();
 useBoard(b);UTX=b.utx;cv.setAttribute('viewBox',b.vb);$('cvb').innerHTML=b.bg;$('brd').value=id;$('stChip').textContent=b.status;$('si').placeholder='Send to Serial ('+b.serialName+')…';
 parts=[];wires=[];sel=null;pend=null;devReset();initS();fillEx();const i=EXS.findIndex(e=>(e.board||'bluepill')==id);
 if(i>=0){$('ex').value=i;$('ex').onchange()}
 menu();draw();chips();log('Board: '+b.name)}
Object.values(BOARDS).forEach(b=>{const o=document.createElement('option');o.value=b.id;o.textContent=b.name;$('brd').appendChild(o)});
$('brd').value=BRD.id;$('brd').onchange=()=>setBoard($('brd').value);
