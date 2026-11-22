// ---------- board registry: everything that differs between boards lives in one object (board-bluepill.js, board-lpc1768.js)
// A board provides: id, name, BN (pins: id, label, x, y, d = wire direction, tip), DUP, svg() (dynamic layer), bg (static layer), vb (viewBox),
// ports / npins (GPIO geometry), gpio (regex of GPIO labels), pn(p,i) / parse(label) (port,pin <-> label), utx (UART TX pin per UART),
// create(host) (chip), flashBase / flashSize / vecOk(sp,reset), target (compile server), status, serialName, diagType, noParts / noI2C,
// i2cPins(k), adcPin(ch), examples are the EXS entries whose "board" matches.
const BOARDS={};let BRD,BID,BN=[],DUP=new Set(),LV=[];
const base=n=>{const m=/^(.*)\.\d$/.exec(n);return m&&DUP.has(m[1])?m[1]:n};
// groups of pins -> BN. A label that occurs more than once (GND, 3V3) gets a .N suffix so every physical pin has its own id.
function makePins(groups,tip){const cl={},sn={},bn=[];groups.forEach(g=>g.ls.forEach(l=>cl[l]=(cl[l]||0)+1));
 groups.forEach(g=>g.ls.forEach((l,i)=>bn.push({id:cl[l]>1?l+'.'+(sn[l]=(sn[l]||0)+1):l,l,x:g.x+(g.dx||0)*i,y:g.y+(g.dy||0)*i,d:g.d,side:g.d[0]<0?'l':'r',tip:tip&&tip(l)||l})));
 return{BN:bn,DUP:new Set(Object.keys(cl).filter(k=>cl[k]>1))}}
function useBoard(b){BRD=b;BID=b.id;BN=b.BN;DUP=b.DUP;LV=[...Array(b.ports)].map(()=>new Int8Array(b.npins))}
const pn=(p,i)=>BRD.pn(p,i);
const partOk=t=>!BRD.noParts.has(t)&&!(BRD.noI2C&&D[t]&&D[t].i2c);
