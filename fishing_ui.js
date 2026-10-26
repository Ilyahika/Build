/* Viva Fishing UI — isolated from Admin.js. All inventory changes happen in Python API. */
(() => {
  'use strict';
  let state = null;
  let selected = 'pond';
  let bagFilter = 'fish';
  let latest = null;
  let busy = false;
  let loading = false;
  let fetching = null;
  let error = '';

  const h = x => esc(x);
  const money = x => fmt(x);
  const colors = {
    common:'Обычная', rare:'Редкая', epic:'Эпическая', marine:'Морская',
    secret:'Секретная', exclusive:'Эксклюзив'
  };
  const rarityTag = r => `<span class="f-rarity r-${h(r)}">${h(colors[r] || r)}</span>`;
  const location = () => state?.locations.find(x=>x.key === selected) || state?.locations[0];
  const defaultState = () => `<div class="panel fishing-loading"><span class="spin"></span>
      <h2>${error ? 'Не удалось загрузить рыбалку' : 'Подготавливаем рыбалку...'}</h2>
      ${error ? `<p class="m">${h(error)}</p>` : '<p class="m">Проверяем снасти и рюкзак.</p>'}
      <button class="full" onclick="Fishing.refresh(true)">↻ Повторить</button></div>`;

  function setState(next){state=next;error='';}
  async function refresh(force=false){
    if (fetching) return fetching;
    if (state && !force) return state;
    loading=true;
    fetching=(async()=>{
      try {const next=await api('/api/fishing/state',undefined,{timeout:20000});setState(next);return next;}
      catch(e){error=e.message;throw e;}
      finally {loading=false;fetching=null;if(S)paint();}
    })();
    return fetching;
  }
  const gearByKey = key => state?.catalog.gear.find(g=>g.key===key);
  const count = items => items.reduce((acc,i)=>acc+i.amount,0);
  const locationClass = key => 'loc-'+h(key);

  function scene(loc){
    return `<div class="f-scene ${locationClass(loc.key)}" aria-hidden="true">
        <div class="f-scene-sun"></div><span class="f-hill one"></span><span class="f-hill two"></span>
        <div class="f-boat">⛵</div><div class="f-water"><span></span><span></span><span></span></div>
        <div class="f-scene-label"><b>${h(loc.name)}</b><small>${h(loc.subtitle)}</small></div>
      </div>`;
  }

  function card(obj, amount, type='fish', opts={}){
    const canEquip = type==='gear';
    const equipped=canEquip && (state.progress.rod===obj.key || state.progress.tackle===obj.key);
    const sellable = type==='fish';
    const secondary = sellable ? `Продажа: ₽ ${money(obj.value)}` :
      canEquip ? `Удача +${Math.round(obj.luck*100)}%` : 'Находка коллекции';
    return `<div class="f-item rborder-${h(obj.rarity)}">
      <div class="f-item-icon">${h(obj.icon)}</div>
      <div class="f-item-body"><b>${h(obj.name)}</b>${rarityTag(obj.rarity)}<small>${secondary}</small></div>
      <div class="f-item-side"><strong>×${money(amount)}</strong>
        ${canEquip ? `<button class="sm ${equipped?'ghost':''}" onclick="Fishing.equip('${h(obj.key)}')" ${equipped?'disabled':''}>${equipped?'Надето':'Надеть'}</button>` : ''}
        ${sellable ? `<button class="sm ghost" onclick="Fishing.sell('${h(obj.key)}')">Продать</button>` : ''}
      </div></div>`;
  }

  function fishView(){
    if (!state) return defaultState();
    const loc=location(), prog=state.progress;
    const discovered=new Set(state.discovered || state.fish.map(i=>i.key));
    const localFish=state.catalog.fish.filter(f=>f.location===loc.key);
    const reward=latest ? `<div class="panel f-catch-result rborder-${h(latest.fish.rarity)}">
        <div class="f-catch-art">${h(latest.fish.icon)}</div>
        <div><div class="f-overline">ПОСЛЕДНИЙ УЛОВ</div><h3>${h(latest.fish.name)}</h3>
          ${rarityTag(latest.fish.rarity)}<p class="m">${h(latest.location)} · стоимость ₽ ${money(latest.fish.value)}</p>
          ${latest.find ? `<div class="f-extra">🎁 Находка: ${h(latest.find.icon)} ${h(latest.find.name)} ${rarityTag(latest.find.rarity)}</div>`:''}
        </div></div>` : '';
    const rod=gearByKey(prog.rod),tackle=gearByKey(prog.tackle);
    return `<div class="f-heading"><div><div class="f-overline">VIVA · FISHING CLUB</div><h1>Рыбалка <span>открыта</span></h1><p>Исследуй 5 водоёмов и собери коллекцию из 20 рыб.</p></div><span class="f-live-pill">● ONLINE</span></div>
      <div class="f-quickstats"><div><small>Всего уловов</small><b>${money(prog.catches)}</b></div>
      <div><small>Найдено вещей</small><b>${money(count(state.finds))}</b></div>
      <div><small>Удочка</small><b>${h(rod?.name||'—')}</b></div></div>
      <div class="f-section-title"><h2>Выбери локацию</h2><span>5 доступных локаций</span></div>
      <div class="f-locations">${state.locations.map(l=>`<button class="f-location ${l.key===loc.key?'active':''} ${locationClass(l.key)}" onclick="Fishing.select('${h(l.key)}')">
        <span class="f-location-icon">${h(l.icon)}</span><span><b>${h(l.name)}</b><small>${h(l.subtitle)}</small></span>${l.key===loc.key?'<span class="f-loc-check">✓</span>':''}</button>`).join('')}</div>
      ${scene(loc)}
      <div class="panel f-cast-panel"><div class="f-cast-heading"><div><div class="f-overline">ГОТОВНОСТЬ СНАСТЕЙ</div><h2>${h(loc.description)}</h2></div><span class="f-tackle-icon">🎣</span></div>
        <div class="f-equipped"><span>${h(rod?.icon||'🎣')} ${h(rod?.name||'Удочка')}</span><span>${h(tackle?.icon||'🪝')} ${h(tackle?.name||'Оснастка')}</span></div>
        <button id="fishCastBtn" class="full f-cast-btn" onclick="Fishing.cast()" ${busy?'disabled':''}>${busy?'🎣 Ловим...':'🎣 Забросить удочку'}</button>
        <p class="m f-cast-help">Рыба и находки сохраняются в рюкзаке. Заброс бесплатный. Перерыв между забросами — 4 секунды.</p>
      </div>
      ${reward}
      <div class="panel"><div class="f-section-title"><h2>Рыбы этой локации</h2><span>${localFish.length} вида</span></div>
        <div class="f-species">${localFish.map(f=>`<div class="f-species-item ${discovered.has(f.key)?'found':''}"><span>${h(f.icon)}</span><b>${h(f.name)}</b>${rarityTag(f.rarity)}</div>`).join('')}</div></div>`;
  }

  function gearItem(obj){
    const own=state.gear.find(g=>g.key===obj.key);
    const isEquipped=state.progress[obj.type==='rod'?'rod':'tackle']===obj.key;
    return `<div class="f-gear-tile rborder-${h(obj.rarity)} ${own?'owned':'locked'}">
      <span class="f-gear-icon">${h(obj.icon)}</span><div class="f-gear-info"><b>${h(obj.name)}</b>${rarityTag(obj.rarity)}<p class="m">Бонус к удаче: +${Math.round(obj.luck*100)}%</p></div>
      ${own?`<button class="sm ${isEquipped?'ghost':''}" onclick="Fishing.equip('${h(obj.key)}')" ${isEquipped?'disabled':''}>${isEquipped?'Надето':'Надеть'}</button>`:'<span class="f-lock">🔒</span>'}</div>`;
  }
  function caseCard(c){
    return `<div class="f-case-card case-${h(c.key)}"><div class="f-case-icon">${h(c.icon)}</div>
      <div class="f-case-info"><b>${h(c.name)}</b><p>${h(c.subtitle)}</p>
        <small>Доступно открытий: <strong>${money(c.available)}</strong> · Открыто: ${money(c.opened)}</small>
      </div><button class="${c.available?'':'ghost'}" onclick="Fishing.openCase('${h(c.key)}')" ${!c.available||busy?'disabled':''}>${c.available?'Открыть':'Закрыт'}</button>
      <details><summary>Возможные награды и шансы</summary><div class="f-case-odds">${c.rewards.map(g=>`<div>${h(g.icon)} ${h(g.name)} ${rarityTag(g.rarity)} <b>${g.chance}%</b></div>`).join('')}</div></details></div>`;
  }
  function gearView(){
    if (!state) return defaultState();
    const rod=gearByKey(state.progress.rod),tackle=gearByKey(state.progress.tackle);
    return `<div class="f-heading"><div><div class="f-overline">СНАРЯЖЕНИЕ</div><h1>Мои <span>снасти</span></h1><p>Улучши удочку и оснастку, чтобы повысить шанс редкой добычи.</p></div></div>
      <div class="f-equipped-panels"><div class="panel"><small>УДОЧКА</small><div class="f-equipped-big">${h(rod?.icon||'🎣')}</div><b>${h(rod?.name||'—')}</b>${rarityTag(rod?.rarity||'common')}</div>
      <div class="panel"><small>ОСНАСТКА</small><div class="f-equipped-big">${h(tackle?.icon||'🪝')}</div><b>${h(tackle?.name||'—')}</b>${rarityTag(tackle?.rarity||'common')}</div></div>
      <div class="panel"><div class="f-section-title"><h2>Удочки</h2><span>6 видов</span></div><div class="f-gear-grid">${state.catalog.gear.filter(g=>g.type==='rod').map(gearItem).join('')}</div></div>
      <div class="panel"><div class="f-section-title"><h2>Оснастки</h2><span>6 видов</span></div><div class="f-gear-grid">${state.catalog.gear.filter(g=>g.type==='tackle').map(gearItem).join('')}</div></div>
      <div class="f-section-title"><h2>4 бесплатных кейса</h2><span>Награды за уловы</span></div>
      <p class="m">Открытия зарабатываются ловлей рыбы: их не нужно покупать. Все возможные награды и шансы указаны в кейсе.</p>
      <div class="f-case-grid">${state.cases.map(caseCard).join('')}</div>`;
  }
  function bagView(){
    if (!state) return defaultState();
    const fishAmount=count(state.fish), findAmount=count(state.finds);
    const sections=[['fish','🐟 Рыба',fishAmount],['finds','✨ Находки',findAmount],['gear','🎣 Снасти',count(state.gear)]];
    let content='';
    if (bagFilter==='fish'){
      const total=state.fish.reduce((a,f)=>a+f.amount*f.value,0);
      content=`<div class="f-bag-toolbar"><span>Продажа всей рыбы: <b>₽ ${money(total)}</b></span>
        <button class="sm" onclick="Fishing.sell('all')" ${fishAmount&&!busy?'':'disabled'}>Продать всю рыбу</button></div>
        ${state.fish.length?state.fish.map(f=>card(f,f.amount)).join(''):'<div class="f-empty">🐟<b>Рюкзак пока пуст</b><p>Отправляйся на рыбалку за первым уловом.</p></div>'}`;
    } else if (bagFilter==='finds'){
      content=state.finds.length?state.finds.map(f=>card(f,f.amount,'find')).join(''):
        '<div class="f-empty">✨<b>Находок пока нет</b><p>Редкие предметы иногда попадаются при забросе.</p></div>';
    } else {
      content=state.gear.length?state.gear.map(g=>card(g,g.amount,'gear')).join(''):
        '<div class="f-empty">🎣<b>Нет снастей</b></div>';
    }
    return `<div class="f-heading"><div><div class="f-overline">КОЛЛЕКЦИЯ ИГРОКА</div><h1>Мой <span>рюкзак</span></h1><p>Здесь хранятся улов, найденные вещи, удочки и оснастки.</p></div></div>
      <div class="f-bag-counters"><div><small>Рыба</small><b>${money(fishAmount)}</b></div><div><small>Находки</small><b>${money(findAmount)}</b></div><div><small>Снасти</small><b>${money(count(state.gear))}</b></div></div>
      <div class="f-bag-switch">${sections.map(([k,l,n])=>`<button class="${bagFilter===k?'on':''}" onclick="Fishing.bagTab('${k}')">${l} <small>${money(n)}</small></button>`).join('')}</div>
      <div class="f-bag-list">${content}</div>
      <div class="panel f-rarity-guide"><h2>Редкости</h2><div class="f-rarities">${Object.entries(colors).map(([key])=>rarityTag(key)).join('')}</div>
        <p class="m">Эксклюзивные находки и снасти выделены золотом. Находки остаются в коллекции.</p></div>`;
  }

  async function action(path,body,onResult){
    if(busy) return;
    busy=true; if(S) paint();
    try {const r=await api('/api/fishing/'+path,body,{timeout:20000});
      if(r.state) setState(r.state);
      if(onResult) await onResult(r);
      if(S)paint();return r;
    } catch(e){note('⚠️ '+e.message);}
    finally{busy=false; if(S)paint();}
  }
  function choose(key){if(!state?.locations.some(l=>l.key===key)) return; selected=key;latest=null;paint();}
  async function cast(){
    await action('cast',{location:selected}, async r=>{latest=r.result;
      note('🎣 Поймано: '+r.result.fish.name+(r.result.find?' · находка: '+r.result.find.name:''));});
  }
  async function equip(key){await action('equip',{gear_key:key},()=>note('✓ Снасть надета'));}
  async function openCase(key){await action('case/open',{case_key:key},r=>note('🎁 '+r.reward.name+' · '+colors[r.reward.rarity]));}
  async function sell(key){
    if(key==='all' && !state?.fish.length)return;
    await action('sell',{fish_key:key},async r=>{
      note('₽ +'+money(r.earned)+' за рыбу');
      try{setS(await api('/api/bh/state'));}catch(e){note('Продано, но баланс не обновился: '+e.message);}
    });
  }

  setInterval(()=>{
    if(!state || busy) return;
    const el=document.getElementById('fishCastBtn'); if(!el)return;
    if(S?.is_admin){el.disabled=false; el.textContent='🎣 Забросить удочку';return;}
    const delay=Math.max(0,state.progress.cooldown_seconds-(Math.floor(Date.now()/1000)-state.progress.last_cast));
    el.disabled=delay>0;
    el.textContent=delay>0?`⌛ Следующий заброс через ${delay} сек.`:'🎣 Забросить удочку';
  },500);

  window.Fishing={refresh,fishView,gearView,bagView,select:choose,bagTab:key=>{bagFilter=key;paint();},
    cast,equip,openCase,sell};
})();
