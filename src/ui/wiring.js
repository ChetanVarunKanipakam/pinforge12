// ---------- right-angle wire routing
function route2(p0,d0,p1,d1,m,idx){const s=G,A=[p0[0]+d0[0]*s,p0[1]+d0[1]*s],B=p1?[p1[0]+d1[0]*s,p1[1]+d1[1]*s]:null;let pts=[p0,A],mid=null;
 if(!B){pts.push(d0[0]?[cur[0],A[1]]:[A[0],cur[1]],cur);return{pts}}
 const h0=d0[0]!=0,h1=d1[0]!=0,j=((idx||0)%3-1)*G;
 if(h0&&h1){const x=m!=null?m:(d0[0]==d1[0]?(d0[0]>0?Math.max(A[0],B[0])+s:Math.min(A[0],B[0])-s):snap((A[0]+B[0])/2)+j);pts.push([x,A[1]],[x,B[1]]);mid={axis:'x',v:x,hp:[x,(A[1]+B[1])/2]}}
 else if(!h0&&!h1){const y=m!=null?m:(d0[1]==d1[1]?(d0[1]>0?Math.max(A[1],B[1])+s:Math.min(A[1],B[1])-s):snap((A[1]+B[1])/2)+j);pts.push([A[0],y],[B[0],y]);mid={axis:'y',v:y,hp:[(A[0]+B[0])/2,y]}}
 else if(h0){if((B[0]-A[0])*d0[0]>=0)pts.push([B[0],A[1]]);else{const y=snap((A[1]+B[1])/2)+j;pts.push([A[0],y],[B[0],y]);mid={axis:'y',v:y,hp:[(A[0]+B[0])/2,y]}}}
 else{if((B[1]-A[1])*d0[1]>=0)pts.push([A[0],B[1]]);else{const x=snap((A[0]+B[0])/2)+j;pts.push([x,A[1]],[x,B[1]]);mid={axis:'x',v:x,hp:[x,(A[1]+B[1])/2]}}}
 pts.push(B,p1);const o=[];for(const p of pts){const l=o[o.length-1];if(l&&l[0]==p[0]&&l[1]==p[1])continue;o.push(p)}
 for(let i=o.length-2;i>0;i--){const a=o[i-1],b=o[i],c=o[i+1];if((a[0]==b[0]&&b[0]==c[0])||(a[1]==b[1]&&b[1]==c[1]))o.splice(i,1)}
 return{pts:o,mid}}
function wireRoute(w,i){const a=pinGeo(w[0]),b=pinGeo(w[1]);return a&&b?route2(a.p,a.d,b.p,b.d,w.m,i):null}
const pathOf=pts=>'M'+pts.map(p=>p[0]+' '+p[1]).join('L');
