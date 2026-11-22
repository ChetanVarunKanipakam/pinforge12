// ---------- board: STM32 Blue Pill (STM32F103C8T6)
BOARDS.bluepill=(()=>{
 const L=['PB12','PB13','PB14','PB15','PA8','PA9','PA10','PA11','PA12','PA15','PB3','PB4','PB5','PB6','PB7','PB8','PB9','5V','GND','3V3'];
 const R=['GND','GND','3V3','RST','PB11','PB10','PB1','PB0','PA7','PA6','PA5','PA4','PA3','PA2','PA1','PA0','PC15','PC14','PC13','VB'];
 const ALT={PA0:'WKUP, USART2_CTS, ADC0, TIM2_CH1',PA1:'USART2_RTS, ADC1, TIM2_CH2',PA2:'USART2_TX, ADC2, TIM2_CH3',PA3:'USART2_RX, ADC3, TIM2_CH4',PA4:'SPI1_NSS, ADC4',PA5:'SPI1_SCK, ADC5',PA6:'SPI1_MISO, ADC6, TIM3_CH1',PA7:'SPI1_MOSI, ADC7, TIM3_CH2',PA8:'TIM1_CH1',PA9:'USART1_TX, TIM1_CH2',PA10:'USART1_RX, TIM1_CH3',PA11:'USB_DM, CAN_RX, TIM1_CH4',PA12:'USB_DP, CAN_TX',PA15:'JTDI, SPI1_NSS (remap)',PB0:'ADC8, TIM3_CH3',PB1:'ADC9, TIM3_CH4',PB3:'JTDO, SPI1_SCK (remap)',PB4:'JNTRST, SPI1_MISO (remap)',PB5:'I2C1_SMBA, SPI1_MOSI (remap)',PB6:'I2C1_SCL, TIM4_CH1',PB7:'I2C1_SDA, TIM4_CH2',PB8:'TIM4_CH3, I2C1_SCL (remap)',PB9:'TIM4_CH4, I2C1_SDA (remap)',PB10:'I2C2_SCL, USART3_TX',PB11:'I2C2_SDA, USART3_RX',PB12:'SPI2_NSS, I2C2_SMBA, USART3_CK, TIM1_BKIN',PB13:'SPI2_SCK, USART3_CTS, TIM1_CH1N',PB14:'SPI2_MISO, USART3_RTS, TIM1_CH2N',PB15:'SPI2_MOSI, TIM1_CH3N',PC13:'on-board LED (active low), TAMPER-RTC',PC14:'OSC32_IN',PC15:'OSC32_OUT'};
 const p=makePins([{ls:L,x:60,y:60,dy:G,d:[-1,0]},{ls:R,x:180,y:60,dy:G,d:[1,0]}],l=>ALT[l]?l+' · GPIO, '+ALT[l]:null);
 return{id:'bluepill',name:'STM32 Blue Pill',...p,svg:bluepillSvg,bg:'',vb:'0 0 760 520',
  ports:3,npins:16,gpio:/^P[A-C]\d+$/,pn:(p,i)=>'P'+'ABC'[p]+i,parse:l=>{const m=/^P([A-C])(\d+)$/.exec(l);return m?['ABC'.indexOf(m[1]),+m[2]]:null},
  utx:['PA9','PA2','PB10'],create:h=>new CM3(h),target:'stm32f103',flashBase:0x08000000,flashSize:65536,vecOk:(sp,rv)=>sp>=0x20000000&&sp<=0x20005000&&rv>=0x08000000&&rv<0x08010000,
  status:'STM32F103C8 · 8 MHz',serialName:'USART1',diagType:'board-stm32-bluepill',noParts:new Set(),noI2C:false,i2c0:1,
  i2cPins:k=>k==0?((M&&(M.afio.mapr&2))?['PB8','PB9']:['PB6','PB7']):['PB10','PB11'],adcPin:ch=>ch<8?'PA'+ch:ch==8?'PB0':ch==9?'PB1':null}})();
function bluepillSvg(){const s13=S.PC13,on13=s13&&s13.m=='OUTPUT'&&!s13.o;
 let h=`<rect x="36" y="30" width="168" height="440" rx="8" fill="#1b4fa3" stroke="#0e2f66" stroke-width="2"/><rect x="96" y="6" width="48" height="30" rx="3" fill="#c8ccd2"/><rect x="104" y="6" width="32" height="12" fill="#8a8f98"/>
<rect x="48" y="50" width="24" height="400" rx="2" fill="#15181d"/><rect x="168" y="50" width="24" height="400" rx="2" fill="#15181d"/>
<circle cx="120" cy="96" r="11" fill="#dcdcdc"/><circle cx="120" cy="96" r="7" fill="#444"/><text x="120" y="120" fill="#cfe" font-size="7" text-anchor="middle" font-family="monospace">RESET</text>
<rect x="104" y="140" width="32" height="10" fill="#222"/><rect x="108" y="142" width="7" height="6" fill="#e6c200"/><rect x="125" y="142" width="7" height="6" fill="#e6c200"/><text x="120" y="162" fill="#cfe" font-size="7" text-anchor="middle" font-family="monospace">BOOT0/1</text>
<rect x="94" y="196" width="52" height="52" rx="3" fill="#161616"/><circle cx="102" cy="204" r="2.5" fill="#555"/><text transform="translate(126 240) rotate(-90)" fill="#cfcfcf" font-size="8.5" font-family="monospace">STM32F103C8T6</text>
<rect x="104" y="282" width="32" height="12" rx="6" fill="#b9bec6"/><rect x="104" y="320" width="9" height="6" fill="#d9c27a"/><rect x="128" y="320" width="9" height="6" fill="#d9c27a"/>
<rect x="114" y="428" width="12" height="8" fill="${on13?'#ffd400':'#6b6b2a'}"/>${on13?'<circle cx="120" cy="432" r="14" fill="#ffd400" opacity=".3"/>':''}<text x="120" y="450" fill="#cfe" font-size="7" text-anchor="middle" font-family="monospace">PC13</text>
<text x="120" y="372" fill="#9fc0f0" font-size="9" text-anchor="middle" font-family="sans-serif" font-weight="700">Blue Pill</text>`;
 BN.forEach(b=>{h+=`<text x="${b.side=='l'?b.x+10:b.x-10}" y="${b.y+3}" fill="#e8eefc" font-size="7.5" text-anchor="${b.side=='l'?'start':'end'}" font-family="monospace">${b.l}</text>`});return h}
