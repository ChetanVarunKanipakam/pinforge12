// ---------- editor
function hl(s){s=s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 return s.replace(/(\/\/.*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(#define|#include|\b(?:function|let|const|var|if|else|for|while|return|break|continue|new|true|false|null|int|unsigned|char|void|static|volatile|typedef|struct|sizeof|uint32_t|uint8_t|uint16_t)\b)|\b(P[A-C]\d{1,2}|GPIO[A-C]|RCC|EXTI|AFIO|TIM[2-4]|USART[1-3]|ADC1)\b|\b(0x[0-9a-fA-F]+|\d+(?:\.\d+)?)\b/g,(m,a,b,c,d,e)=>`<span class="c${a?1:b?2:c?3:d?5:6}">${m}</span>`)+'\n'}
function setCode(v){$('code').value=v;sync()}
function sync(){const v=$('code').value;$('hl').innerHTML=hl(v);$('gut').textContent=Array.from({length:v.split('\n').length},(_,i)=>i+1).join('\n')}
const csrc=()=>FW&&FW.src!=null?FW.src:'/* Custom firmware: '+(FW?FW.name:'none')+'\n   No source is available for loaded binaries.\n   Initial SP: 0x'+(FW?new DataView(FW.bytes.buffer).getUint32(0,true).toString(16):'-')+'\n   Reset vector: 0x'+(FW?new DataView(FW.bytes.buffer).getUint32(4,true).toString(16):'-')+' */';
function codeEditable(){return fileTab=='c'?(CAN&&FW&&FW.src!=null&&!building):!run}
function showFile(t){fileTab=t;document.querySelectorAll('.ftabs span').forEach(x=>x.classList.toggle('a',x.dataset.f==t));if(t=='c')setCode(csrc());else draw();$('code').readOnly=!codeEditable();noteUpdate()}
document.querySelectorAll('.ftabs span').forEach(s=>s.onclick=()=>showFile(s.dataset.f));
$('code').addEventListener('input',()=>{if(fileTab=='c'){if(CAN&&FW&&FW.src!=null){FW.src=$('code').value;FW.dirty=true;chips()}}else if(!run){try{skipJson=true;applyDiagram(JSON.parse($('code').value))}catch(e){skipJson=false}}sync()});
$('code').addEventListener('scroll',()=>{$('gut').scrollTop=$('hl').scrollTop=$('code').scrollTop;$('hl').scrollLeft=$('code').scrollLeft});
function noteUpdate(){$('note').textContent=fileTab=='json'?(run?'Read-only while the simulation runs.':'Wokwi-style circuit description — edits update the circuit.'):CAN?(FW&&FW.src!=null?'Edit main.c, press Build (Ctrl+B), then Run (Ctrl+Enter). Build compiles with arm-none-eabi-gcc; Run starts the last build.':'Loaded binary — no source. Press Run.'):'No compile server connected: examples and loaded .bin/.elf/.hex files run, but editing needs the hosted compile server.'}
