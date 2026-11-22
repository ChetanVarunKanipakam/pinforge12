# Regenerates src/ui/board-lpc1768-art.js (static board artwork for the canvas). Usage: python3 tools/gen_lpc_board.py
import re
f=lambda n:('%.1f'%n).rstrip('0').rstrip('.')
o=[];a=o.append
XS=[241+101.7*i for i in range(19)]
T1=['3V3','GND','P0.0','P0.1','P0.2','P0.3','P0.4','P0.5','P0.6','P0.7','P0.8','P0.9','P0.10','P0.11','P0.15','P0.16','P0.17','P0.18','P0.19']
T2=['3V3','GND','P0.20','P0.21','P0.22','P0.23','P0.24','P0.25','P0.26','P0.27','P0.28','P0.29','P0.30','P1.0','P1.1','P1.4','P1.8','P1.9','P1.10']
B1=['3V3','GND','P1.14','P1.15','P1.16','P1.17','P1.18','P1.19','P1.20','P1.21','P1.22','P1.23','P1.24','P1.25','P1.26','P1.27','P1.28','P1.29','P1.30']
B2=['P1.31','P2.0','P2.1','P2.2','P2.3','P2.4','P2.5','P2.6','P2.7','P2.8','P2.9','P2.10','P2.11','P2.12','P2.13','P3.25','P3.26','P4.28','P4.29']
FONT='DejaVu Sans,Verdana,Arial,sans-serif'
a(f'''<svg viewBox="0 0 2310 1590" width="756" height="520" role="img" aria-label="Top view of the PinForge LPC1768 development board: NXP LPC1768 in an LQFP100 package in the centre, two 2 by 19 pin headers along the top and bottom edges, USB device connector, RESET and ISP switches, 12 MHz crystal, 3.3 V regulator, power LED, UART0 header and JTAG/SWD header">
<defs>
<linearGradient id="bd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#15814a"/><stop offset=".6" stop-color="#0f6a3c"/><stop offset="1" stop-color="#0b5a33"/></linearGradient>
<linearGradient id="hd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#232326"/><stop offset="1" stop-color="#0c0c0e"/></linearGradient>
<linearGradient id="cp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#363639"/><stop offset="1" stop-color="#1b1b1d"/></linearGradient>
<linearGradient id="sv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f5f7"/><stop offset=".5" stop-color="#b3b6bc"/><stop offset="1" stop-color="#dfe1e4"/></linearGradient>
<linearGradient id="svh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f4f5f7"/><stop offset=".5" stop-color="#a9acb2"/><stop offset="1" stop-color="#dfe1e4"/></linearGradient>
<linearGradient id="gd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4d98a"/><stop offset="1" stop-color="#b98f34"/></linearGradient>
<linearGradient id="tn" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d4b074"/><stop offset="1" stop-color="#a98349"/></linearGradient>
<radialGradient id="bl" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#636367"/><stop offset="1" stop-color="#0e0e10"/></radialGradient>
<filter id="bs" x="-5%" y="-5%" width="110%" height="115%"><feGaussianBlur stdDeviation="5"/></filter>
<filter id="ds" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="4" dy="6" stdDeviation="4" flood-color="#000" flood-opacity=".45"/></filter>
<g id="pin"><rect x="-30" y="-30" width="60" height="60" fill="#262629"/><path d="M-30-30H30L12-12H-12Z" fill="#3c3c40"/><path d="M-30-30V30L-12 12V-12Z" fill="#303034"/><path d="M30-30V30L12 12V-12Z" fill="#141416"/><path d="M-30 30H30L12 12H-12Z" fill="#0b0b0d"/><rect x="-12" y="-12" width="24" height="24" fill="url(#gd)" stroke="#6b5420" stroke-width="2"/></g>
<g id="via"><circle r="12" fill="#e7bb4c" stroke="#8a6a1c" stroke-width="2.5"/><circle r="4.5" fill="#0c5a35"/></g>
</defs>
<rect x="72" y="112" width="2197" height="1400" rx="48" fill="#000" opacity=".25" filter="url(#bs)"/>
<rect x="58" y="98" width="2197" height="1400" rx="48" fill="url(#bd)" stroke="#0a4a2c" stroke-width="10"/>
<rect x="72" y="112" width="2169" height="1372" rx="38" fill="none" stroke="#38b57a" stroke-opacity=".4" stroke-width="3"/>''')
# mounting holes
for cx,cy in[(128,180),(2187,180),(128,1420),(2187,1420)]:
    a(f'<circle cx="{cx}" cy="{cy}" r="56" fill="#8e9096" filter="url(#ds)"/><circle cx="{cx}" cy="{cy}" r="50" fill="url(#sv)" stroke="#6c6f75" stroke-width="4"/><circle cx="{cx}" cy="{cy}" r="33" fill="#d7d9dc" stroke="#7c7f85" stroke-width="5"/>')
# traces
a('<g fill="none" stroke="#33b57a" stroke-width="5" stroke-linejoin="round" opacity=".85">')
for i in range(25):
    y=552+21.7*i; ty=y+(i-12)*9; cx=895+21.9*i
    a(f'<path d="M818 {f(y)}H790L{f(742)} {f(ty)}H690M1498 {f(y)}H1526L1574 {f(ty)}H1626"/>')
    a(f'<path d="M{f(cx+4.5)} 462V430L{f(cx+(i-12)*7)} 390M{f(cx+4.5)} 1141V1175L{f(cx+(i-12)*7)} 1215"/>')
a('</g>')
for x,y in[(515,677),(540,662),(590,631),(618,616),(598,724),(621,708),(545,756),(568,739),(652,785),(678,770),(490,988),(838,558),(1486,558),(838,1037),(1486,1037),(955,410),(1040,425),(1120,438),(1175,413),(1207,438),(1305,410),(1040,1177),(1122,1163),(1175,1190),(1207,1165),(1290,1180),(955,1193),(1700,617),(1721,632),(1747,648),(1665,693),(1691,708),(1769,662),(1799,680),(1740,740),(1636,772),(1661,787),(1641,848),(1680,863),(1709,942),(1747,957),(1785,972),(1823,987)]:
    a(f'<use href="#via" x="{x}" y="{y}"/>')
# headers
def hdr(x,y,w,h,xs,ys):
    a(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="9" fill="url(#hd)" stroke="#000" stroke-width="4" filter="url(#ds)"/>')
    for py in ys:
        for px in xs:a(f'<use href="#pin" x="{f(px)}" y="{f(py)}"/>')
hdr(190,140,1935,206,XS,[191,293]);hdr(190,1257,1935,206,XS,[1309,1411])
# labels
a(f'<g font-family="{FONT}" font-weight="700" font-size="27" text-anchor="middle"><g fill="#c9d8f0">')
for x,t in zip(XS,T1):a(f'<text x="{f(x)}" y="72">{t}</text>')
for x,t in zip(XS,B2):a(f'<text x="{f(x)}" y="1552">{t}</text>')
a('</g><g fill="#f2f8f4">')
for x,t in zip(XS,T2):a(f'<text x="{f(x)}" y="383">{t}</text>')
for x,t in zip(XS,B1):a(f'<text x="{f(x)}" y="1242">{t}</text>')
a('</g></g>')
# chip legs
a('<g fill="none"><path d="M895 492H1430M895 1112H1430" stroke="#dde0e3" stroke-width="58" stroke-dasharray="9.4 12.5"/><path d="M848 541V1070M1468 541V1070" stroke="#dde0e3" stroke-width="60" stroke-dasharray="9.4 12.3"/></g>')
a('<g fill="none" stroke="#eef0f2" stroke-width="5" stroke-linecap="round"><path d="M816 505V433H890M1497 505V433H1425M816 1098V1170H890M1497 1098V1170H1425"/></g>')
a('<rect x="878" y="523" width="560" height="558" rx="20" fill="url(#cp)" stroke="#000" stroke-width="5" filter="url(#ds)"/><rect x="890" y="535" width="536" height="534" rx="12" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="3"/><circle cx="937" cy="582" r="15" fill="#050506"/>')
a(f'<g font-family="{FONT}" font-weight="700" text-anchor="middle"><text x="1157" y="698" font-size="128" fill="#8a8a8f">NXP</text><text x="1157" y="815" font-size="52" fill="#98989d">LPC1768FBD100</text><text x="1157" y="882" font-size="44" font-weight="400" fill="#6d6d72">ARM Cortex-M3</text><text x="1157" y="944" font-size="38" font-weight="400" fill="#5d5d62">100 MHz</text></g>')
# smd helpers
def tan(x,y,w=55,h=32):a(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="url(#tn)" stroke="#6e5530" stroke-width="2"/><rect x="{x}" y="{y}" width="10" height="{h}" fill="#e7e9ec" opacity=".85"/><rect x="{x+w-10}" y="{y}" width="10" height="{h}" fill="#e7e9ec" opacity=".85"/>')
def blk(x,y,t,w=47,h=27):a(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#19191b" stroke="#000" stroke-width="2"/><rect x="{x}" y="{y}" width="7" height="{h}" fill="#bfc2c6"/><rect x="{x+w-7}" y="{y}" width="7" height="{h}" fill="#bfc2c6"/><text x="{x+w/2}" y="{y+21}" font-family="{FONT}" font-size="20" fill="#e8eaec" text-anchor="middle">{t}</text>')
def tall(x,y,w=56,h=118):a(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="url(#tn)" stroke="#6e5530" stroke-width="2"/><rect x="{x}" y="{y}" width="{w}" height="12" fill="#e7e9ec" opacity=".9"/><rect x="{x}" y="{y+h-12}" width="{w}" height="12" fill="#e7e9ec" opacity=".9"/>')
for x in(880,1038,1198,1357,1457):tan(x,398);tan(x,1181)
for x,t in zip((958,1117,1277,1410),('103','104','472','221')):blk(x,405,t)
for x,t in zip((958,1117,1277,1410),('102','221','103','104')):blk(x,1188,t)
# LED1, crystal, left parts
a(f'<rect x="120" y="424" width="128" height="72" rx="8" fill="#eceeee" stroke="#9fa2a5" stroke-width="3" filter="url(#ds)"/><rect x="152" y="439" width="64" height="40" rx="6" fill="#7be3a5"/>')
a(f'<g font-family="{FONT}" fill="#eef7f1"><text x="272" y="484" font-size="66" font-weight="700">PWR</text><text x="183" y="530" font-size="24" text-anchor="middle">LED1</text></g>')
a(f'<rect x="450" y="424" width="318" height="120" rx="60" fill="url(#sv)" stroke="#6b6e74" stroke-width="3" filter="url(#ds)"/><rect x="468" y="440" width="282" height="88" rx="44" fill="none" stroke="#fff" stroke-width="5" opacity=".8"/><text x="609" y="502" font-family="{FONT}" font-size="62" font-weight="700" fill="#80848a" text-anchor="middle">12.000</text><text x="609" y="585" font-family="{FONT}" font-size="26" fill="#eef7f1" text-anchor="middle">Y1 12 MHz</text>')
blk(120,555,'1K',48,26);blk(120,595,'1K',48,26);tan(200,557,48,30);tan(278,637,57,32);blk(280,686,'472');tall(449,622)
a(f'<rect x="548" y="622" width="30" height="92" rx="15" fill="url(#svh)" stroke="#6b6e74" stroke-width="2" filter="url(#ds)"/><text x="562" y="750" font-family="{FONT}" font-size="22" fill="#eef7f1" text-anchor="middle">Y2</text>')
tan(635,627);blk(698,627,'223');tan(635,670);tan(703,670);blk(622,719,'105');blk(698,719,'104')
# USB
a(f'<path d="M58 601H292V884H58" fill="none" stroke="#eef0f2" stroke-width="5"/><rect x="178" y="650" width="58" height="180" fill="#1b1b1d" filter="url(#ds)"/><rect x="207" y="625" width="28" height="30" fill="url(#gd)"/><rect x="207" y="822" width="28" height="30" fill="url(#gd)"/>')
a('<rect x="32" y="634" width="146" height="210" rx="16" fill="url(#svh)" stroke="#6b6e74" stroke-width="4" filter="url(#ds)"/><path d="M32 690H160V790H48L32 774Z" fill="#101012"/><rect x="48" y="718" width="108" height="34" rx="6" fill="#2a2a2d"/><path d="M56 726H148M56 735H148M56 744H148" stroke="#d8b25a" stroke-width="5"/>')
a(f'<g font-family="{FONT}" font-weight="700" font-size="52" fill="#f2f8f4"><text x="92" y="940">USB</text><text x="55" y="994">Device</text></g>')
# U4
a('<g fill="#c9ccd0">')
for y in(788,815,843,870):a(f'<rect x="303" y="{y}" width="34" height="14"/><rect x="421" y="{y}" width="34" height="14"/>')
a(f'</g><rect x="335" y="776" width="88" height="124" rx="5" fill="#161618" stroke="#000" stroke-width="3" filter="url(#ds)"/><circle cx="353" cy="794" r="6" fill="#333"/><text x="378" y="935" font-family="{FONT}" font-size="22" fill="#eef7f1" text-anchor="middle">U4</text>')
# JTAG/SWD
a(f'<text x="160" y="1040" font-family="{FONT}" font-size="44" font-weight="700" fill="#f2f8f4">JTAG / SWD</text>')
hdr(160,1057,364,152,[195,267,339,411,483],[1097,1169])
# RESET / ISP
def sw(cx,cy):
    x,y=cx-102,cy-101
    a(f'<g filter="url(#ds)"><g fill="url(#sv)" stroke="#6b6e74" stroke-width="3"><rect x="{x-28}" y="{y+30}" width="46" height="34" rx="3"/><rect x="{x-28}" y="{y+141}" width="46" height="34" rx="3"/><rect x="{x+184}" y="{y+30}" width="46" height="34" rx="3"/><rect x="{x+184}" y="{y+141}" width="46" height="34" rx="3"/></g><rect x="{x}" y="{y}" width="204" height="202" rx="16" fill="#cfd1d5" stroke="#9fa2a7" stroke-width="4"/><circle cx="{cx}" cy="{cy}" r="82" fill="#b7b9be" stroke="#85888e" stroke-width="7"/><circle cx="{cx}" cy="{cy}" r="62" fill="url(#bl)"/></g>')
sw(619,888);sw(1666,1078)
a(f'<g font-family="{FONT}" fill="#f2f8f4" text-anchor="middle"><text x="617" y="1062" font-size="58" font-weight="700">RESET</text><text x="618" y="1106" font-size="26">SW1</text><text x="1665" y="1212" font-size="44" font-weight="700">ISP</text></g>')
blk(570,1142,'330');blk(570,1178,'221');tan(660,1142)
# right side
tall(1547,411,56,120)
a('<g fill="url(#svh)" stroke="#6b6e74" stroke-width="2"><rect x="1627" y="430" width="54" height="28"/><rect x="1627" y="479" width="54" height="28"/><rect x="1627" y="528" width="54" height="26"/></g><rect x="1802" y="435" width="76" height="112" fill="url(#svh)" stroke="#6b6e74" stroke-width="2"/>')
a(f'<rect x="1681" y="403" width="121" height="160" rx="9" fill="#17171a" stroke="#000" stroke-width="4" filter="url(#ds)"/><g font-family="{FONT}" fill="#8d8d92" text-anchor="middle"><text x="1741" y="474" font-size="26">1117</text><text x="1741" y="505" font-size="26">3.3</text></g><text x="1741" y="595" font-family="{FONT}" font-size="26" fill="#eef7f1" text-anchor="middle">U2 3V3</text>')
for x,t in zip((1954,2054,2154),('104','106','103')):tall(x,411,58,116);blk(x-6,552,t)
a(f'<g font-family="{FONT}" font-weight="700" fill="#f8fbf9"><text x="1644" y="680" font-size="58">Dev Board</text><text x="1526" y="796" font-size="144">LPC1768</text><text x="1522" y="918" font-size="70">ARM Cortex-M3</text></g><rect x="1526" y="824" width="559" height="7" fill="#f8fbf9"/>')
tan(1818,985,57,30);blk(1890,990,'103',50,26)
a('<g fill="#c9ccd0"><rect x="2088" y="928" width="32" height="14"/><rect x="2088" y="955" width="32" height="14"/><rect x="2088" y="982" width="32" height="14"/><rect x="2208" y="928" width="32" height="14"/><rect x="2208" y="955" width="32" height="14"/><rect x="2208" y="982" width="32" height="14"/></g>')
a(f'<rect x="2120" y="917" width="88" height="96" rx="5" fill="#161618" stroke="#000" stroke-width="3" filter="url(#ds)"/><circle cx="2139" cy="936" r="6" fill="#333"/><g font-family="{FONT}" fill="#eef7f1" text-anchor="middle"><text x="2163" y="900" font-size="24">U3</text><text x="2005" y="1030" font-size="28">UART0</text></g>')
hdr(1805,1097,408,88,[1855,1957,2058,2160],[1141])
a(f'<g font-family="{FONT}" font-weight="700" font-size="30" fill="#f2f8f4" text-anchor="middle"><text x="1855" y="1070">3V3</text><text x="1957" y="1070">GND</text><text x="2060" y="1070">TXD0</text><text x="2160" y="1070">RXD0</text></g>')
a('</svg>')
svg=''.join(o)

import json
body=svg[svg.index('>')+1:svg.rindex('</svg>')]
for k in ('id="','url(#','href="#'):body=body.replace(k,k+'lp-' if k!='url(#' else 'url(#lp-')
S=20/101.7;TX=60-241*S;TY=60-191*S
bg='<g transform="translate(%.3f %.3f) scale(%.5f)">%s</g>'%(TX,TY,S,body)
out='// generated by tools/gen_lpc_board.py from the board artwork - do not edit by hand\nconst LPC_ROWS='+json.dumps({'T1':T1,'T2':T2,'B1':B1,'B2':B2})+';\nconst LPC_BG='+json.dumps(bg)+';\n'
open('src/ui/board-lpc1768-art.js','w').write(out)
print('board-lpc1768-art.js',len(out),'bytes')
