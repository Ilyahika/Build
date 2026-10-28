'use strict';
// V12: specimen images are shown exclusively inside fish cards.
const artBeforeV12=itemArt;
itemArt=function(item,extra=''){
  if(item.location&&item.art?.atlas?.startsWith('fish12_')){
    if(!extra.split(' ').includes('collect-art'))return `<span class="fish-list-symbol" aria-hidden="true">${ico('fish')}</span>`;
    const a=item.art,[x,y,w,h]=a.rect,[sw,sh]=a.size;
    return `<span class="fish-photo-frame ${extra}" role="img" aria-label="${esc(item.name)}"><span class="fish-photo" style="background-image:url('/assets/${a.atlas}.webp');background-size:${sw/w*100}% ${sh/h*100}%;background-position:${x/(sw-w)*100}% ${y/(sh-h)*100}%"></span></span>`;
  }
  return artBeforeV12(item,extra);
};
const visualRandom=()=>{if(globalThis.crypto?.getRandomValues){const x=new Uint32Array(1);crypto.getRandomValues(x);return x[0]/4294967296}return Math.random()};
roulette=function(c,winner){return new Promise(resolve=>{
  const winnerIndex=52+Math.floor(visualRandom()*5),landing=.045+visualRandom()*.91,duration=7800+visualRandom()*600;
  const list=Array.from({length:64},()=>c.rewards[Math.floor(visualRandom()*c.rewards.length)]);list[winnerIndex]=winner;
  const m=$('modal');m.hidden=false;m.innerHTML=`<section class="premium-roll" role="dialog" aria-modal="true" aria-label="Открытие кейса"><div class="roll-overline">VIVA · CASE COLLECTION</div><h1>${esc(c.name)}</h1><p class="roll-caption" id="roll-caption">Сейчас решится…</p><div class="roulette-window premium-roll-window"><div class="roulette-strip premium-roll-strip">${list.map((g,i)=>`<article class="roulette-item premium-roll-item rarity-${g.rarity}" data-roll-index="${i}"><span class="roll-rarity-line"></span>${itemArt(g,'collect-art')}<small>${esc(g.name)}</small><span class="roll-item-rarity">${esc(S.catalog.rarities[g.rarity])}</span></article>`).join('')}</div><div class="roll-shade left"></div><div class="roll-shade right"></div><div class="roulette-needle premium-roll-needle"><i></i></div></div><div class="roll-footer"><span class="roll-status"><i></i><b id="roll-stage">Рулетка запущена</b></span><button class="ghost" id="skip-roll">Пропустить анимацию</button></div></section>`;
  const strip=m.querySelector('.premium-roll-strip'),viewport=m.querySelector('.premium-roll-window'),cards=[...strip.children],winning=cards[winnerIndex];let ended=false,finishing=false,animation=null,raf=0,timer=0,lastIndex=-1,lastHaptic=0;
  const target=()=>viewport.clientWidth/2-winning.offsetLeft-winning.offsetWidth*landing;
  const finish=(quick=false)=>{if(ended||finishing)return;finishing=true;cancelAnimationFrame(raf);clearTimeout(timer);animation?.cancel();strip.style.transform=`translateX(${target()}px)`;cards.forEach(c=>c.classList.remove('under-needle'));winning.classList.add('roll-winner');$('roll-stage').textContent='Твой предмет';$('roll-caption').textContent=winner.name;tg?.HapticFeedback?.notificationOccurred?.('success');setTimeout(()=>{if(ended)return;ended=true;m.hidden=true;resolve()},quick?180:750)};
  $('skip-roll').onclick=()=>finish(true);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(finishing)return;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const span=reduced?250:duration;
    strip.style.transform='translateX(0px)';animation=strip.animate([{transform:'translateX(0px)'},{transform:`translateX(${target()}px)`}],{duration:span,easing:'cubic-bezier(.10,.72,.12,1)',fill:'forwards'});
    const start=performance.now();
    const frame=()=>{if(finishing||ended)return;const now=performance.now(),p=Math.min(1,(now-start)/span),matrix=new DOMMatrixReadOnly(getComputedStyle(strip).transform),needle=viewport.clientWidth/2-matrix.m41,pitch=cards[1].offsetLeft-cards[0].offsetLeft,index=Math.max(0,Math.min(cards.length-1,Math.floor(needle/pitch)));
      if(index!==lastIndex){cards[lastIndex]?.classList.remove('under-needle');cards[index]?.classList.add('under-needle');lastIndex=index;if(now-lastHaptic>110){tg?.HapticFeedback?.impactOccurred?.('light');lastHaptic=now}}
      $('roll-stage').textContent=p<.35?'Разгон':p<.75?'Рулетка замедляется':'Ещё мгновение…';raf=requestAnimationFrame(frame)};
    frame();animation.finished.then(()=>finish()).catch(()=>{});timer=setTimeout(()=>finish(),span+300);
  }));
});};

const CATCH_THEMES={
common:{name:'Тихий берег',tag:'ОБЫЧНЫЙ УЛОВ',sky:['#426f83','#c9cfa4'],water:['#427d7b','#163c45'],accent:'#dce3e2',coat:'#c69858',mode:0,description:'Спокойная вода. Уверенное вываживание.'},
rare:{name:'Серебряное течение',tag:'РЕДКИЙ УЛОВ',sky:['#124c75','#64c8dc'],water:['#217d9b','#082a48'],accent:'#6cdfff',coat:'#4382b0',mode:1,description:'Течение оживает вокруг лески.'},
epic:{name:'Лунная глубина',tag:'ЭПИЧЕСКИЙ УЛОВ',sky:['#110e35','#675087'],water:['#423969','#151e42'],accent:'#c594ff',coat:'#7763a7',mode:2,description:'Лунные кольца поднимаются из глубины.'},
professional:{name:'Янтарный горизонт',tag:'ПРОФЕССИОНАЛЬНЫЙ УЛОВ',sky:['#472a34','#ffb674'],water:['#92654f','#273a44'],accent:'#ffa65b',coat:'#bb7046',mode:3,description:'Сильный рывок на закатной воде.'},
legendary:{name:'Золотой час',tag:'ЛЕГЕНДАРНЫЙ УЛОВ',sky:['#463a35','#ffdf92'],water:['#7f7852','#203e42'],accent:'#ffeaa1',coat:'#c5a15c',mode:4,description:'Солнечные лучи пронизывают поверхность.'},
mythic:{name:'Багровая буря',tag:'МИФИЧЕСКИЙ УЛОВ',sky:['#180e22','#71313c'],water:['#4f263d','#101f33'],accent:'#ff607c',coat:'#993c55',mode:5,description:'Буря сгущается. Держи курс к берегу.'},
secret:{name:'За гранью тишины',tag:'СЕКРЕТНЫЙ УЛОВ',sky:['#080b16','#525363'],water:['#313444','#0c1520'],accent:'#e6efff',coat:'#626b7d',mode:6,description:'Время замедлилось. Глубина открывает тайну.'}
};
// Canvas scene: fisherman, rod, water and rarity VFX. No fish bitmap or fish silhouette.
function drawCatchScene(ctx,W,H,theme,t,p){
  const o=theme,mode=o.mode,A=o.accent,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const ellipse=(x,y,rx,ry,color,alpha=1)=>{ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1};
  const line=(points,color,width=2,alpha=1)=>{ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();for(let i=0;i<points.length;i++)i?ctx.lineTo(...points[i]):ctx.moveTo(...points[i]);ctx.stroke();ctx.globalAlpha=1};
  ctx.setTransform(W/1000,0,0,H/900,0,0);ctx.clearRect(0,0,1000,900);ctx.save();
  const pulse=Math.sin(t*(mode===5?12:4)),zoom=1+.04*Math.sin(p*Math.PI),shake=mode===5?Math.sin(t*31)*p*1.8:0;
  ctx.translate(500+shake,450);ctx.scale(zoom,zoom);ctx.translate(-500,-450);
  let g=ctx.createLinearGradient(0,0,0,460);g.addColorStop(0,o.sky[0]);g.addColorStop(1,o.sky[1]);ctx.fillStyle=g;ctx.fillRect(-40,-40,1080,570);
  if(mode===2||mode>=5){for(let i=0;i<45;i++){const x=(i*137+67)%1000,y=(i*71+33)%330;ellipse(x,y,1+(i%3)*.5,1+(i%3)*.5,'#fff',.2+.35*(.5+.5*Math.sin(t*.8+i)))} }
  // Sun, moon, eclipse and the shafts belong to different rarity scenes.
  const sunX=750,sunY=150;
  g=ctx.createRadialGradient(sunX,sunY,5,sunX,sunY,220);g.addColorStop(0,A+(mode===6?'66':'77'));g.addColorStop(1,A+'00');ctx.fillStyle=g;ctx.fillRect(480,-90,520,500);
  if(mode===6){ellipse(sunX,sunY,66,66,'#eef2ff');ellipse(sunX-8,sunY-5,61,61,'#111320');ctx.save();ctx.globalAlpha=.55;ctx.strokeStyle='#bdc6e5';ctx.lineWidth=1;ctx.beginPath();ctx.arc(sunX,sunY,80,0,Math.PI*2);ctx.stroke();ctx.restore()}
  else {ellipse(sunX,sunY,mode===4?66:48,mode===4?66:48,mode===5?'#dc687b':'#fff3d5',.85);if(mode===2)ellipse(sunX+19,sunY-15,42,42,o.sky[0]);}
  if(mode===4){for(let i=0;i<8;i++){ctx.save();ctx.globalAlpha=.04+.025*Math.sin(t+i);ctx.fillStyle='#fff3b2';ctx.beginPath();ctx.moveTo(sunX-20,sunY);ctx.lineTo(i*180-230,900);ctx.lineTo(i*180-110,900);ctx.closePath();ctx.fill();ctx.restore()}}
  if(mode===6){for(let k=0;k<3;k++){ctx.save();ctx.globalCompositeOperation='screen';ctx.lineWidth=38;ctx.strokeStyle=`hsla(${(t*18+k*105)%360},75%,65%,.12)`;ctx.beginPath();ctx.moveTo(-40,130+k*35);for(let x=0;x<=1060;x+=30)ctx.lineTo(x,150+k*45+Math.sin(x*.006+t*.2+k)*70);ctx.stroke();ctx.restore()}}
  for(let layer=0;layer<3;layer++){ctx.fillStyle=['#344e5e','#203b49','#142f3b'][layer];ctx.globalAlpha=.5+layer*.15;ctx.beginPath();ctx.moveTo(-40,490);for(let x=-40;x<=1040;x+=40)ctx.lineTo(x,350+layer*40-Math.sin(x*(.007+layer*.002)+layer*2)*55-Math.sin(x*.017+layer)*24);ctx.lineTo(1040,550);ctx.closePath();ctx.fill();ctx.globalAlpha=1}
  // distant pines
  for(let i=0;i<22;i++){let x=i*49,y=420+Math.sin(i*1.6)*12,h=30+(i*13)%50;ctx.fillStyle='#1a3540';ctx.beginPath();ctx.moveTo(x,y-h);ctx.lineTo(x-13,y);ctx.lineTo(x+13,y);ctx.closePath();ctx.fill()}
  g=ctx.createLinearGradient(0,440,0,900);g.addColorStop(0,o.water[0]);g.addColorStop(1,o.water[1]);ctx.fillStyle=g;ctx.fillRect(-40,445,1080,500);
  for(let i=0;i<38;i++){const y=455+i*12,l=15+i*4,x=(i*113+Math.sin(t*.25+i)*38)%1100;line([[x-l,y],[x+l,y+Math.sin(t*1.8+i)*2]],A,.8+i*.035,.08+(i%4)*.025)}
  // Reflected path under the sun.
  for(let i=0;i<20;i++){const y=450+i*12,w=18+i*3;line([[sunX-w+Math.sin(t+i)*7,y],[sunX+w+Math.sin(t+i)*7,y]],A,2,.03+(1-i/20)*.16)}
  const poolX=740+Math.sin(t*.8)*8,poolY=647+Math.sin(t*1.2)*4;
  if(mode===1){for(let i=0;i<8;i++){const y=530+i*23;ctx.strokeStyle='#78defa';ctx.globalAlpha=.12;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(400,y);ctx.bezierCurveTo(560,y-30,780,y+50,1050,y+10);ctx.stroke();ctx.globalAlpha=1}}
  if(mode===2){for(let k=0;k<3;k++){ctx.save();ctx.globalAlpha=.1;ctx.fillStyle='#aa8cf5';ctx.beginPath();ctx.ellipse(poolX,610-k*40,230+k*18,28+k*4,0,0,Math.PI*2);ctx.fill();ctx.restore()}}
  const ringCount=mode===0?2:mode===6?9:mode===5?6:4;
  for(let i=0;i<ringCount;i++){const q=(t*.48+i/ringCount)%1;ctx.strokeStyle=mode===6?`hsla(${i*43+t*25},85%,80%,${(1-q)*.65})`:A;ctx.globalAlpha=mode===6?1:(1-q)*(.2+mode*.06);ctx.lineWidth=mode===0?1.5:2.3;ctx.beginPath();ctx.ellipse(poolX,poolY,12+q*(mode===6?250:140),4+q*(mode===6?65:35),0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}
  if(mode===2||mode===4||mode===6){const n=mode===6?22:12;for(let i=0;i<n;i++){const a=t*.3+i/n*Math.PI*2,r=90+Math.sin(t+i)*12;ellipse(poolX+Math.cos(a)*r,poolY+Math.sin(a)*r*.3,2,2,mode===6?`hsl(${i*24+t*35},80%,80%)`:A,.55)}}
  // Splash arcs and droplets, increasing with the pull and rarity.
  const climax=clamp((p-.7)/.3,0,1),intensity=.25+Math.sin(t*3)**4*.4+climax*.6;
  for(let i=0;i<8+mode*5;i++){const q=(t*.7+i*.071)%1,x=poolX+Math.sin(i*8.91)*(30+q*70),y=poolY-Math.sin(q*Math.PI)*(35+mode*12)*intensity;ellipse(x,y,1.2+(i%3)*.65,2.8,A,(1-q)*.65)}
  if(mode===3){for(let i=0;i<36;i++){const q=(t*.16+i*.079)%1,x=(i*83+Math.sin(t+i)*30)%1000,y=850-q*720;ellipse(x,y,1.5+(i%2),1.5+(i%2),'#ffd29c',Math.sin(q*Math.PI)*.65)}}
  if(mode===4){for(let i=0;i<48;i++){const q=(t*.12+i*.077)%1,x=(i*137)%1000,y=820-q*650;ctx.save();ctx.translate(x,y);ctx.rotate(t*.4+i);ctx.globalAlpha=Math.sin(q*Math.PI)*.6;ctx.fillStyle='#fff0a9';ctx.fillRect(-1,-5,2,10);ctx.fillRect(-5,-1,10,2);ctx.restore()}}
  if(mode===5){for(let i=0;i<55;i++){const x=(i*97+t*150)%1100-50,y=(i*137+t*560)%1000-60;line([[x,y],[x-12,y+30]],'#c0c8dd',1,.12)}if(Math.sin(t*2.4)>.975){line([[630,0],[660,65],[625,100],[673,170],[650,220]],'#ffc5d6',3,.8);ctx.fillStyle='#ff88aa0a';ctx.fillRect(0,0,1000,900)}}
  if(mode===6){for(let i=0;i<28;i++){const a=i*.71+t*.24,r=60+(i%7)*26;ctx.save();ctx.translate(poolX+Math.cos(a)*r,poolY-80+Math.sin(a)*r*.7);ctx.rotate(-a);ctx.strokeStyle=`hsla(${i*30+t*40},60%,90%,.45)`;ctx.strokeRect(-3,-3,6,6);ctx.restore()}}
  // Low bank and foreground stones.
  ctx.fillStyle='#102c30';ctx.beginPath();ctx.moveTo(-50,760);ctx.bezierCurveTo(110,700,250,770,370,835);ctx.bezierCurveTo(500,880,560,850,640,940);ctx.lineTo(-50,940);ctx.closePath();ctx.fill();ellipse(180,813,105,24,'#06171e',.45);
  // Fisherman seen from behind. Lean, shoulders, hands and pole all move.
  ctx.save();ctx.translate(270+Math.sin(t*1.7)*2,790);ctx.rotate(-.035-Math.sin(t*2.6)*(.015+mode*.002)-climax*.035);
  line([[-38,-118],[-58,-8]],'#1b2738',34);line([[28,-120],[53,-6]],'#243347',34);ellipse(-64,0,30,13,'#101d29');ellipse(60,0,30,13,'#101d29');
  ctx.fillStyle=o.coat;ctx.beginPath();ctx.moveTo(-67,-278);ctx.quadraticCurveTo(0,-313,65,-269);ctx.lineTo(58,-106);ctx.quadraticCurveTo(0,-91,-58,-110);ctx.closePath();ctx.fill();
  ctx.fillStyle='#0c2936';ctx.fillRect(-47,-283,15,155);ctx.fillRect(29,-280,15,155);line([[-33,-235],[31,-231]],'#c3cfb1',5,.6);line([[-31,-201],[30,-198]],'#c3cfb1',5,.45);ctx.fillStyle='#1e3e4a';ctx.fillRect(-29,-180,57,50);line([[0,-177],[0,-132]],'#4b6870',2);
  ellipse(0,-310,36,39,'#a77857');ellipse(-1,-337,52,14,'#273f49');ctx.fillStyle='#37515a';ctx.beginPath();ctx.roundRect(-35,-372,69,42,17);ctx.fill();line([[-31,-338],[31,-338]],'#8ca6a5',3,.55);
  const handX=145+Math.sin(t*2.6)*9,handY=-235-Math.sin(t*2.6)*6-climax*14;
  line([[-49,-260],[17,-218],[handX-8,handY+10]],o.coat,27);line([[49,-259],[105,-238],[handX,handY]],o.coat,23);ellipse(handX,handY,12,11,'#bb916c');ellipse(handX-12,handY+12,10,9,'#b88b64');
  line([[handX-24,handY+36],[handX+18,handY-28]],'#332e29',11);
  const strain=(.18+mode*.13)*(1+climax*1.9),tipX=390+Math.sin(t*2.6)*22-strain*45,tipY=-510+Math.sin(t*2.6)*15+strain*105;
  ctx.strokeStyle='#ddd4ad';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(handX,handY);ctx.quadraticCurveTo(300-strain*58,-570+strain*64,tipX,tipY);ctx.stroke();ctx.strokeStyle='#718c91';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(handX+2,handY);ctx.quadraticCurveTo(302-strain*58,-564+strain*64,tipX+1,tipY);ctx.stroke();
  ctx.strokeStyle='#d3e9e7';ctx.lineWidth=1;ctx.globalAlpha=.8;ctx.beginPath();ctx.moveTo(tipX,tipY);ctx.quadraticCurveTo(470,-330,poolX-270,poolY-790);ctx.stroke();ctx.globalAlpha=1;ellipse(handX+3,handY+15,12,12,'#a2a7a6');ellipse(handX+3,handY+15,7,7,'#33444e');ctx.restore();
  // Reeds in foreground.
  for(let i=0;i<12;i++){let x=20+i*13;line([[x,900],[x-12+Math.sin(t+i)*4,815-(i%3)*18]],'#2e5753',3);}
  if(climax>0){ctx.save();ctx.globalCompositeOperation='screen';g=ctx.createRadialGradient(poolX,poolY,0,poolX,poolY,180);g.addColorStop(0,A+Math.round(climax*100).toString(16).padStart(2,'0'));g.addColorStop(1,A+'00');ctx.fillStyle=g;ctx.fillRect(poolX-200,poolY-200,400,400);ctx.restore()}
  ctx.restore();ctx.setTransform(1,0,0,1,0,0);
}
window.VivaCatchScene={draw:drawCatchScene,themes:CATCH_THEMES};
startBattle=function(initial){
  let b=initial,sequence=0,stopped=false,inFlight=false,raf=0,timer=0;const theme=CATCH_THEMES[b.fish.rarity]||CATCH_THEMES.common,m=$('modal');battle=b;m.hidden=false;
  m.innerHTML=`<section class="catch-film rarity-${b.fish.rarity}" role="dialog" aria-modal="true" aria-label="Вываживание"><div class="film-heading"><div><span class="film-label">${theme.tag}</span><h2>${theme.name}</h2></div><span class="film-live"><i></i> LIVE</span></div><div class="film-stage"><canvas id="catch-canvas" aria-label="Рыбак вытягивает улов у берега"></canvas><div class="film-vignette"></div><div class="film-corners"><i></i><i></i><i></i><i></i></div><div class="film-phase" id="film-phase">ЗАБРОС</div></div><div class="film-bottom"><p id="catch-status">${theme.description}</p><div class="film-progress"><span id="catch-progress"></span></div><div class="film-controls"><small id="film-time">Вываживание началось</small><button class="ghost" id="hide-catch">Свернуть</button></div></div></section>`;
  const canvas=$('catch-canvas'),ctx=canvas.getContext('2d'),began=performance.now(),elapsed=Math.max(0,(Date.now()+offset)/1000-b.started),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const resize=()=>{const r=canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr))};resize();const observer=new ResizeObserver(resize);observer.observe(canvas);
  function frame(){if(stopped)return;const t=elapsed+(performance.now()-began)/1000,p=Math.min(1,t/b.duration);drawCatchScene(ctx,canvas.width,canvas.height,theme,reduced?Math.floor(t*4)/4:t,p);$('catch-progress').style.width=p*100+'%';$('film-phase').textContent=p<.22?'ПОКЛЁВКА':p<.7?'ВЫВАЖИВАНИЕ':p<.96?'У САМОГО БЕРЕГА':'ТРОФЕЙ ПОЛУЧЕН';$('film-time').textContent=`${Math.min(b.duration,t).toFixed(1)} / ${b.duration} сек`;raf=requestAnimationFrame(frame)}
  const stop=()=>{stopped=true;clearInterval(timer);cancelAnimationFrame(raf);observer.disconnect();battle=null;m.hidden=true};
  $('hide-catch').onclick=()=>{stop();paint()};
  async function step(){if(stopped||inFlight)return;inFlight=true;try{const r=await api('/api/fishing/tick',{id:b.id,position:.5,sequence:++sequence});if(stopped)return;b=r.battle;battle=b;if(r.done){stop();accept(r.state);paint();const f=S.catches[0];m.hidden=false;m.innerHTML=`<section class="film-result"><div class="roll-overline">ТВОЙ НОВЫЙ УЛОВ</div><div class="film-result-card collect-card rarity-${b.fish.rarity}">${rarity(b.fish)}<h1>${esc(b.fish.name)}</h1>${itemArt(b.fish,'collect-art')}<div class="film-result-stats"><b>${weightText(b.kg)}<small>килограммов</small></b><b>$${fmt(f?.value||0)}<small>стоимость</small></b><b>+${b.xp}<small>EXP</small></b></div></div><button class="full" onclick="closeModal()">Продолжить рыбалку</button><button class="ghost full" onclick="closeModal();go('bag')">Открыть подсак</button></section>`;tg?.HapticFeedback?.notificationOccurred?.('success');note(b.fish.name+' · '+weightText(b.kg)+' кг',b.fish.rarity,'Улов в подсаке')}}catch(e){if(!stopped)$('catch-status').textContent=e.message+' · повторяем соединение'}finally{inFlight=false}}
  timer=setInterval(step,600);frame();step();
};
