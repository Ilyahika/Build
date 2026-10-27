'use strict';
const EMOJI_V13={"🎣": "emoji-1f3a3.svg", "🐟": "emoji-1f41f.svg", "🐠": "emoji-1f420.svg", "🦈": "emoji-1f988.svg", "🐙": "emoji-1f419.svg", "⚓": "emoji-2693.svg", "🚤": "emoji-1f6a4.svg", "🦆": "emoji-1f986.svg", "🐳": "emoji-1f433.svg", "🦀": "emoji-1f980.svg", "🦑": "emoji-1f991.svg", "🐬": "emoji-1f42c.svg", "🐢": "emoji-1f422.svg", "🦭": "emoji-1f9ad.svg", "🪼": "emoji-1fabc.svg", "🐡": "emoji-1f421.svg", "🦞": "emoji-1f99e.svg", "🦐": "emoji-1f990.svg", "🪸": "emoji-1fab8.svg", "🐚": "emoji-1f41a.svg", "🌊": "emoji-1f30a.svg", "🏝️": "emoji-1f3dd.svg", "🌙": "emoji-1f319.svg", "🍀": "emoji-1f340.svg", "🧭": "emoji-1f9ed.svg", "✨": "emoji-2728.svg", "👤": "emoji-1f464.svg", "🎁": "emoji-1f381.svg", "🎟️": "emoji-1f39f.svg", "💬": "emoji-1f4ac.svg", "🏆": "emoji-1f3c6.svg", "📖": "emoji-1f4d6.svg", "💎": "emoji-1f48e.svg", "🛠️": "emoji-1f6e0.svg", "🛡️": "emoji-1f6e1.svg", "🎧": "emoji-1f3a7.svg", "⭐": "emoji-2b50.svg", "💰": "emoji-1f4b0.svg", "🎒": "emoji-1f392.svg", "🎉": "emoji-1f389.svg", "✅": "emoji-2705.svg", "💾": "emoji-1f4be.svg", "😇": "emoji-1f607.svg", "🦾": "emoji-1f9be.svg", "👾": "emoji-1f47e.svg", "🤵": "emoji-1f935.svg", "⚪": "emoji-26aa.svg", "🔵": "emoji-1f535.svg", "🟣": "emoji-1f7e3.svg", "🟠": "emoji-1f7e0.svg", "🟡": "emoji-1f7e1.svg", "🔴": "emoji-1f534.svg", "⚫": "emoji-26ab.svg", "🟢": "emoji-1f7e2.svg"};
const emojiPatternV13=new RegExp(Object.keys(EMOJI_V13).sort((a,b)=>b.length-a.length).join('|'),'gu');
function hydrateV13Emojis(root){
 if(!root)return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];let n;
 while(n=walker.nextNode()){if(n.parentElement?.closest('script,style,textarea,option,select,svg'))continue;emojiPatternV13.lastIndex=0;if(emojiPatternV13.test(n.nodeValue))nodes.push(n)}
 for(const node of nodes){const t=node.nodeValue,fragment=document.createDocumentFragment();let end=0;emojiPatternV13.lastIndex=0;for(const match of t.matchAll(emojiPatternV13)){fragment.append(document.createTextNode(t.slice(end,match.index)));const img=document.createElement('img');img.className='v13-emoji';img.src='/assets/'+EMOJI_V13[match[0]];img.alt=match[0];img.draggable=false;img.width=36;img.height=36;fragment.append(img);end=match.index+match[0].length}fragment.append(document.createTextNode(t.slice(end)));node.replaceWith(fragment)}
}

// Bright, solid controls and a persistent bottom-right menu.
function supportButton(){return `<a class="support-link support-v13" href="https://t.me/OKEY_VE" target="_blank" rel="noopener"><span class="support-v13-icon">🎧</span><span><b>Техническая поддержка</b><small>Написать @OKEY_VE</small></span><span class="support-v13-arrow">↗</span></a>`}
menuView=function(){const p=S.player;const cards=[
 ['profile','👤','Мой профиль','Образ, статистика и коллекция','lilac'],
 ['rewards','🎁','Мои награды','Забирай подарки каждый день','peach'],
 ['promo','🎟️','Промокоды','Активируй свой бонус','mint'],
 ['chat','💬','Общий чат','Разговоры на берегу','sky'],
 ['top','🏆','Топ игроков','Лучшие рыбаки клуба','yellow'],
 ['help','📖','Помощь','Правила и подсказки','pink'],
 ['donate','💎','Магазин доната','Скоро · технические работы','cyan'],
 ...(S.role==='admin'?[['admin','🛠️','Администратор','Панель управления','coral']]:[]),
 ...(S.role!=='player'?[['staff','🛡️','Игроки и роли','Паспорта и модерация','periwinkle']]:[])
 ];
 $('view').innerHTML=`<section class="menu-v13"><div class="menu-v13-heading"><div><span class="brand">ТВОЙ РЫБАЦКИЙ КЛУБ</span><h1>Всё под рукой ✨</h1></div><span class="menu-v13-heading-icon">🧭</span></div><div class="menu-v13-profile"><span class="menu-v13-avatar">${esc(p.avatar==='🏠'?'🎣':p.avatar)}</span><div><b>${esc(p.nickname||p.telegram_name)}</b><div class="menu-v13-badges"><span>⭐ Уровень ${S.level.level}</span><span>💰 ${fmt(p.coins)} $</span></div></div></div><div class="menu-v13-grid">${cards.map(([key,emoji,title,sub,tone])=>`<button class="menu-v13-card tone-${tone}" onclick="go('${key}')"><span class="menu-v13-emoji">${emoji}</span><span class="menu-v13-card-arrow">↗</span><b>${title}</b><small>${sub}</small></button>`).join('')}</div>${supportButton()}<p class="menu-v13-footer">Твой следующий трофей уже ждёт 🎣</p></section>`;
};
function enhanceV13(){
 $('header')?.querySelectorAll('.menu-button').forEach(e=>e.remove());
 let fab=$('viva-menu-fab');if(!fab){fab=document.createElement('button');fab.id='viva-menu-fab';fab.className='viva-menu-fab';fab.setAttribute('aria-label','Открыть меню');fab.onclick=()=>{if(lock||battle)return;go(tab==='menu'?'fish':'menu')};document.body.append(fab)}
 fab.classList.toggle('selected',tab==='menu');fab.setAttribute('aria-expanded',String(tab==='menu'));fab.innerHTML=`<span>${tab==='menu'?'✕':'🧭'}</span><b>${tab==='menu'?'Назад':'Меню'}</b>`;
 const navItems=[['fish','🎣','Рыбалка'],['bag','🎒','Рюкзак'],['shop','🎁','Кейсы']];$('nav').innerHTML=navItems.map(([key,emoji,title])=>`<button class="v13-nav-${key} ${tab===key?'active':''}" onclick="go('${key}')"><span>${emoji}</span><b>${title}</b></button>`).join('');
 document.querySelectorAll('a.support-link:not(.support-v13)').forEach(a=>{a.outerHTML=supportButton()});
 // Add helpful emojis to common actions without changing their handlers.
 if(!document.body.classList.contains('adm'))document.querySelectorAll('#view button').forEach(b=>{
   if(b.dataset.v13Decorated||b.querySelector('.v13-emoji'))return;
   if(b.closest('.menu-v13-grid')||b.closest('.location-dots')||b.closest('.scene-wrap'))return;
   const t=b.textContent.trim();if(!t||/^\p{Extended_Pictographic}/u.test(t))return;
   let emoji='';if(b.id==='cast')emoji='🎣';else if(b.id==='case-open'||t.startsWith('Посмотреть кейс'))emoji='🎁';else if(t.startsWith('Продать'))emoji='💰';else if(t==='Надеть')emoji='✅';else if(t==='Надето')emoji='✓';else if(t==='В аквариум')emoji='🪸';else if(t==='В подсак')emoji='🐟';else if(t.startsWith('Забрать'))emoji='🎉';else if(t.startsWith('Активировать'))emoji='🎟️';else if(t.startsWith('Сохранить'))emoji='💾';
   if(emoji){const s=document.createElement('span');s.className='v13-button-emoji';s.textContent=emoji+' ';b.prepend(s);b.dataset.v13Decorated='true'}
 });
 for(const id of ['header','view','nav','viva-menu-fab'])hydrateV13Emojis($(id));
}
const paintBeforeV13=paint;paint=function(){paintBeforeV13();if(S)enhanceV13()};
const fishBeforeV13=fishView;fishView=function(){fishBeforeV13();enhanceV13()};
const bagBeforeV13=bagView;bagView=function(){bagBeforeV13();enhanceV13()};
const caseBeforeV13=caseView;caseView=function(){caseBeforeV13();enhanceV13()};
const cooldownBeforeV13=cooldown;cooldown=function(){cooldownBeforeV13();if($('cast')&&!$('cast').textContent.startsWith('🎣'))$('cast').prepend(document.createTextNode('🎣 '));hydrateV13Emojis($('cast'))};
function batchCaseReveal(c,rewards){return new Promise(resolve=>{
 const m=$('modal'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;let ended=false;const timers=[];m.hidden=false;
 m.innerHTML=`<section class="batch-v13" role="dialog" aria-modal="true" aria-label="Быстрое открытие ${rewards.length} кейсов"><span class="batch-v13-overline">VIVA · МУЛЬТИОТКРЫТИЕ</span><h2>🎁 ${rewards.length} ${rewards.length<5?'кейса':'кейсов'} — один момент</h2><p>${esc(c.name)}</p><div class="batch-v13-grid" data-count="${rewards.length}">${rewards.map((x,i)=>`<article class="batch-v13-item rarity-${x.reward.rarity}" data-batch-card="${i}" style="--order:${i}"><div class="batch-v13-front"><span>🎁</span><b>${i+1}</b></div><div class="batch-v13-reward">${itemArt(x.reward,'collect-art')}<b>${esc(x.reward.name)}</b><small>${esc(S.catalog.rarities[x.reward.rarity])}</small></div></article>`).join('')}</div><div class="batch-v13-progress"><i id="batch-progress"></i></div><div class="batch-v13-bottom"><span id="batch-counter">Открываем подарки…</span><button class="batch-v13-skip" id="batch-skip">Показать все ✨</button></div></section>`;
 const finish=()=>{if(ended)return;ended=true;timers.forEach(clearTimeout);m.hidden=true;resolve()};
 const reveal=(i)=>{if(ended)return;m.querySelector(`[data-batch-card="${i}"]`)?.classList.add('revealed');$('batch-counter').textContent=`Готово ${i+1} / ${rewards.length}`;$('batch-progress').style.width=((i+1)/rewards.length*100)+'%'};
 $('batch-skip').onclick=()=>{if(ended)return;rewards.forEach((_,i)=>reveal(i));timers.forEach(clearTimeout);timers.push(setTimeout(finish,140))};
 rewards.forEach((_,i)=>timers.push(setTimeout(()=>reveal(i),reduced?40:220+i*85)));
 timers.push(setTimeout(()=>{tg?.HapticFeedback?.notificationOccurred?.('success');finish()},reduced?250:220+rewards.length*85+480));
 });}
open11Case=async function(){if(lock)return;lock=true;const c=S.cases.find(c=>c.key===selectedCase),count=caseCount,fast=caseFast,button=$('case-open');if(button)button.disabled=true;
 try{const r=await api('/api/fishing/case/open',{case_key:c.key,revision:c.revision,count});if(count>1)await batchCaseReveal(c,r.rewards);else if(!fast)await roulette(c,r.rewards[0].reward);accept(r.state);paint();const results=$('case-results');if(results){results.innerHTML=`<div class="v13-results-title"><span>🎉</span><div><h2>Твои награды</h2><small>+${35*r.rewards.length} EXP · ${r.rewards.length} ${r.rewards.length===1?'предмет':'предметов'}</small></div></div><div class="collection-grid v13-case-results">${r.rewards.map((x,i)=>`<article class="collect-card rarity-${x.reward.rarity}" style="--result-index:${i}">${rarity(x.reward)}<h3>${esc(x.reward.name)}</h3>${itemArt(x.reward,'collect-art')}<p>${x.auto_sold?'💰 Автопродажа +$'+fmt(x.compensation):'✅ В рюкзаке'}</p></article>`).join('')}</div>`;results.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'})}note(count===1?r.rewards[0].reward.name:`Получено предметов: ${r.rewards.length} · +${35*r.rewards.length} EXP`,r.rewards[0].reward.rarity,count===1?'🎁 Кейс открыт':'🎉 Кейсы открыты');}
 catch(e){note(e.message,'error');if($('case-open'))$('case-open').disabled=false}finally{lock=false}
};

const emojiObserverV13=new MutationObserver(changes=>{for(const c of changes){if([...c.addedNodes].some(n=>{emojiPatternV13.lastIndex=0;return emojiPatternV13.test(n.textContent||'')})){hydrateV13Emojis(c.target.nodeType===1?c.target:c.target.parentElement)}}});
for(const id of ['modal','toast'])emojiObserverV13.observe($(id),{childList:true,subtree:true});
