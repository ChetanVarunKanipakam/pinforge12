// ---------- electrical model
function nodes(){const a=BN.map(b=>BID+':'+b.id);parts.forEach(t=>Object.keys(D[t.type].pins).forEach(k=>a.push(t.id+':'+k)));return a}
function netf(nr){const p={};const f=x=>{p[x]=p[x]||x;while(p[x]!==x){p[x]=p[p[x]]||p[x];x=p[x]}return x},u=(a,b)=>{p[f(a)]=f(b)};
 wires.forEach(w=>u(w[0],w[1]));BN.forEach(b=>{if(['GND','3V3','5V'].includes(b.l))u(BID+':'+b.id,BID+':'+b.l)});
 parts.forEach(t=>{if(t.type=='res'&&!nr)u(t.id+':1',t.id+':2');if(t.type=='btn'){u(t.id+':1.l',t.id+':1.r');u(t.id+':2.l',t.id+':2.r');if(t.down)u(t.id+':1.l',t.id+':2.l')}if(t.type=='kp')(t.kdown||[]).forEach(k=>u(t.id+':R'+(1+(k>>2)),t.id+':C'+(1+(k&3))));if(t.type=='sw')u(t.id+':2',t.id+':'+(t.pos?3:1))});return f}
function sense(f,n){const r=f(n),o={hi:0,lo:0,an:null,lvl:0};
 nodes().forEach(m=>{if(f(m)!=r)return;
  if(m.startsWith(BID+':')){const l=base(m.slice(BID.length+1));if(l=='GND')o.lo=1;else if(l=='3V3'||l=='5V'){o.hi=1;o.lvl=1}else{const s=S[l];if(s&&s.m=='OUTPUT'&&!s.od){const v=s.pw!=null?s.pw:s.o;if(v>0){o.hi=1;o.lvl=Math.max(o.lvl,v)}else o.lo=1}}}
  else if(m.endsWith(':SIG')){const t=part(m.split(':')[0]);if(t&&t.type=='pot')o.an=t.val??2048}else{const dv=drvOf(m);if(dv===1){o.hi=1;o.lvl=Math.max(o.lvl,1)}else if(dv===0)o.lo=1}});return o}
function aread(p){const o=sense(netf(),BID+':'+p);return o.an!=null?o.an:o.hi?4095:0}
function ledB(f,t){const a=sense(f,t.id+':A'),c=sense(f,t.id+':C');return a.hi&&c.lo?Math.max(.2,a.lvl):0}
