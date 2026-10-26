/* ============================================================ Viva Fishing — полная админ-панель (клиент)
   Загружается только администратору (см. go('admin') в app.js). Использует глобальные $, api, esc, fmt, note, ask, run, paint.
   Вкладки: Сводка · Игроки (поиск/фильтры/сортировка/страницы + карточка) · Рассылка · Журнал. */
window.Admin = (() => {
  const PAGE = 25;                                   // игроков на странице
  // Состояние панели
  const A = {sub: 'dash', stats: null, list: null, q: '', flt: 'all', sort: 'last_seen', page: 0,
             card: null, log: null, bc: null, bcText: '', timer: null, live: null, maint: null, cases: null, autoBusy: false};

  /* ---------- утилиты ---------- */
  const enc = encodeURIComponent;
  /** «5 мин назад», «3 ч назад»… */
  const ago = ts => {
    if (!ts) return '—';
    const d = Math.floor(Date.now() / 1000) - ts;
    return d < 60 ? 'сейчас' : d < 3600 ? Math.floor(d / 60) + ' мин назад' : d < 86400 ? Math.floor(d / 3600) + ' ч назад' : Math.floor(d / 86400) + ' дн назад';
  };
  const date = ts => ts ? new Date(ts * 1000).toLocaleString('ru-RU') : '—';
  const ACT_NAMES = {coins_add: '± доллары', coins_set: '= доллары', gems_add: '± звёзды', gems_set: '= звёзды', house_add: '± уровень дома',
    house_set: '= уровень дома', give_car: 'подарок: машина', clear_garage: 'очистка гаража', block: 'блокировка', unblock: 'разблокировка',
    refill_energy: 'энергия', daily_reset: 'сброс бонуса', end_game: 'сброс игры', reset: 'СБРОС АККАУНТА', message: 'сообщение', broadcast: 'рассылка', maintenance_on: 'техработы: включены', maintenance_off: 'техработы: выключены'};

  /** Перерисовка с сохранением прокрутки окна игрока и текста рассылки (чтобы не «прыгало»). */
  function repaint() {
    if ($('bc_text')) A.bcText = $('bc_text').value;
    const before = document.querySelector('.modal')?.scrollTop || 0;
    paint();
    const modal = document.querySelector('.modal');
    if (modal) modal.scrollTop = before;
  }
  const syncQ = () => { if ($('a_q')) A.q = $('a_q').value.trim(); };   // запоминаем введённый поиск

  /* ---------- загрузка данных вкладок ---------- */
  const loaders = {
    dash: async deep => { A.stats = await api('/api/admin/stats' + (deep ? '?deep=true' : ''), undefined, {timeout: 30000}); A.maint = A.stats.maintenance; },
    live: async () => { A.live = await api('/api/admin/live'); },
    works: async () => { A.maint = await api('/api/admin/maintenance'); },
    players: async () => { A.list = await api(`/api/admin/players?q=${enc(A.q)}&flt=${A.flt}&sort=${A.sort}&offset=${A.page * PAGE}&limit=${PAGE}`); },
    bc: async () => { A.bc = await api('/api/admin/broadcast'); pollBc(); },
    cases: async () => { A.cases=await api('/api/admin/cases'); },
    log: async () => { A.log = (await api('/api/admin/log?limit=60')).log; },
  };
  /** Загружает данные текущей вкладки и перерисовывает панель. */
  async function load(deep = false) {
    repaint();                                                    // сразу показываем «Загрузка…»
    await run(async () => {
      if (!A.stats && A.sub !== 'dash') await loaders.dash();     // каталог машин нужен для карточки игрока
      await loaders[A.sub](deep);
    });
    repaint();
  }
  const setSub = k => { syncQ(); A.sub = k; load(); };

  /* ---------- вкладка «Сводка» ---------- */
  function banner(){
    const w = A.maint?.enabled;
    return `<div class="admin-hero"><div class="admin-emblem">∞</div><div style="flex:1"><h1>VIVA <span>CONTROL</span></h1><p>Администратор ID 1181838335 · контроль игроков и инфраструктуры</p></div>
      <div class="admin-status ${w ? 'offline' : ''}"><i class="dot"></i>${w ? 'ТЕХРАБОТЫ' : 'ИГРА ОТКРЫТА'}</div></div>`;
  }
  function dashV() {
    if (!A.stats) return '<div class="panel splash"><div class="spin"></div>Загрузка аналитики…</div>';
    const {stats: st, checks, info, rows, db_ms} = A.stats;
    const kpi = (name, value, suffix='') => `<div><small>${name}</small><b>${value}${suffix}</b></div>`;
    const maxLv = Math.max(1, ...Object.values(st.levels));
    const icon = {ok:'OK', warn:'ВНИМАНИЕ', fail:'ОШИБКА', skip:'—'};
    return `${banner()}
      <div class="panel"><div class="row" style="justify-content:space-between"><h2>ОБЗОР СЕРВЕРА</h2><button class="ghost sm" onclick="Admin.load()">↻ Обновить</button></div>
        <div class="kpi">
          ${kpi('В ИГРЕ СЕЙЧАС',`<span class="live-dot"></span>${fmt(st.online_now)}`)}
          ${kpi('ВСЕГО ИГРОКОВ',fmt(st.players))}
          ${kpi('АКТИВНЫЕ 15 МИН',fmt(st.online_15m))}
          ${kpi('АКТИВНЫЕ ЗА СУТКИ',fmt(st.active_24h))}
          ${kpi('НОВЫЕ ЗА СУТКИ',fmt(st.new_24h))}
          ${kpi('ЗАБЛОКИРОВАНЫ',fmt(st.blocked))}
          ${kpi('МОНЕТЫ ИГРОКОВ','$ '+fmt(st.coins_total))}
          ${kpi('ПОЙМАНО РЫБ',fmt(st.fishing_catches ?? 0))}
          ${kpi('РЫБ В РЮКЗАКАХ',fmt(st.fish_in_bags ?? 0))}
          ${kpi('НАХОДОК В РЮКЗАКАХ',fmt(st.finds_in_bags ?? 0))}
          ${kpi('ОТКРЫТО КЕЙСОВ',fmt(st.cases_opened ?? 0))}
          ${kpi('ОТКЛИК SQLite',fmt(db_ms)+' мс')}
        </div>
        <p class="m" style="margin-top:12px">«В игре сейчас» — игроки, приславшие подписанный запрос за последние 75 секунд. Обновление сводки каждые 12 секунд.</p>
      </div>
      <div class="admin-two">
        <div class="panel"><h2>ТЕХНИЧЕСКОЕ СОСТОЯНИЕ</h2>
          <div class="works-box ${A.maint?.enabled ? 'active' : ''}">
            <b>${A.maint?.enabled ? '🔴 Технические работы включены' : '🟢 Игра доступна игрокам'}</b>
            <p class="m">${esc(A.maint?.enabled ? 'Все обычные игроки видят полноэкранную заглушку. Доступ к игровым API закрыт.' : 'Игроки могут пользоваться Mini App в обычном режиме.')}</p>
            <button class="${A.maint?.enabled ? '' : 'red'}" onclick="Admin.setSub('works')">Управление доступом</button>
          </div>
        </div>
        <div class="panel"><h2>УРОВНИ РЫБАКОВ</h2>
          <div class="bars">${Object.entries(st.levels).map(([lv,n])=>`<div><span>Уровень ${lv}</span><i style="width:${n/maxLv*65}%"></i><em>${n}</em></div>`).join('') || '<p class="m">Пока нет данных</p>'}</div>
          <button class="ghost sm" onclick="Admin.setSub('live')" style="margin-top:12px">Игроки онлайн</button>
        </div>
      </div>
      <div class="panel"><div class="row" style="justify-content:space-between"><h2>ДИАГНОСТИКА · БАЗА ДАННЫХ</h2><button class="ghost sm" onclick="Admin.load(true)">Глубокая проверка</button></div>
        <div class="chk-grid">${checks.map(c => `<div class="chk ${c.s}"><b>${esc(c.n)}<span class="m">${icon[c.s] || ''}</span></b><small>${esc(c.d)}</small></div>`).join('')}</div>
      </div>
      <div class="panel"><h2>ИНФОРМАЦИЯ О СЕРВЕРЕ</h2>
        <div class="kv">${Object.entries(info).map(([k,v])=>`<div><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('')}</div>
        <p class="m">Таблицы: ${Object.entries(rows).map(([k,v])=>`${esc(k)} — ${v}`).join(' · ')}</p>
      </div>`;
  }
  function liveV(){
    const L=A.live;
    if(!L) return '<div class="panel splash"><div class="spin"></div>Загрузка онлайна…</div>';
    return `${banner()}<div class="panel">
      <div class="row" style="justify-content:space-between"><div><h2>ОНЛАЙН В ИГРЕ</h2><p class="m" style="margin:0">${esc(L.definition)} · обновление каждые 12 секунд</p></div><button class="ghost sm" onclick="Admin.load()">↻ Обновить</button></div>
      <div class="kpi" style="margin-top:14px"><div><small>СЕЙЧАС В ИГРЕ</small><b>${fmt(L.count)}</b></div><div><small>СЕЙЧАС ВЫВАЖИВАЮТ</small><b>${fmt(L.active_casts)}</b></div><div><small>ПОСЛЕДНЯЯ ПРОВЕРКА</small><b style="font-size:15px">${date(L.updated_at)}</b></div></div>
      <div style="margin-top:16px">${L.online.length ? L.online.map(p => `<div class="live-row" onclick="Admin.open(${p.telegram_id})"><span class="av">${esc(p.avatar||'👤')}</span><div class="grow"><b><span class="live-dot"></span>${esc(p.nickname || p.telegram_name)}</b><small>ID ${p.telegram_id} · уровень ${p.level} · ${p.blocked?'Заблокирован':'активен'}</small></div><div style="text-align:right"><b>$ ${fmt(p.coins)}</b><div class="m">${ago(p.last_seen)}</div></div></div>`).join(''):'<div class="panel"><p class="m">Сейчас нет активных игроков. Они появятся здесь после открытия Mini App.</p></div>'}</div>
    </div>`;
  }
  function worksV(){
    const w=A.maint;
    if(!w) return '<div class="panel splash"><div class="spin"></div>Загрузка режима техработ…</div>';
    return `${banner()}<div class="panel"><h2>УПРАВЛЕНИЕ ТЕХНИЧЕСКИМИ РАБОТАМИ</h2>
      <div class="works-box ${w.enabled?'active':''}"><div class="admin-status ${w.enabled?'offline':''}"><i class="dot"></i>${w.enabled?'СЕРВЕР ЗАКРЫТ ДЛЯ ИГРОКОВ':'ИГРА ДОСТУПНА'}</div>
        <div class="works-big">${w.enabled?'Техработы включены':'Техработы выключены'}</div>
        <p class="m">Администратор продолжит видеть игру и панель управления. Обычные игроки увидят экран на весь дисплей; игровые запросы сервер отклонит.</p>
      </div>
      <label class="m" for="works_msg">Сообщение игрокам (до 500 символов)</label>
      <textarea id="works_msg" rows="4" maxlength="500" style="margin-top:8px">${esc(w.message)}</textarea>
      <div class="admin-action-bar"><button class="red" onclick="Admin.toggleMaintenance(true)">${w.enabled?'Обновить сообщение':'🔴 Включить техработы'}</button>
        <button class="ghost" onclick="Admin.toggleMaintenance(false)" ${!w.enabled?'disabled':''}>🟢 Выключить техработы</button></div>
      <p class="works-note">Игроки узнают об изменении через периодический опрос (обычно в течение 10–15 секунд). Режим хранится в SQLite3. При выключении экран автоматически исчезнет и игровой профиль перезагрузится.</p>
      <div class="panel"><h2>ПОСЛЕДНЕЕ ИЗМЕНЕНИЕ</h2><p class="m">${w.updated_at?date(w.updated_at):'Режим ещё не меняли'} ${w.updated_by?'· админ '+w.updated_by:''}</p></div>
    </div>`;
  }
  async function toggleMaintenance(enabled){
    const message = $('works_msg')?.value.trim() || 'Мы обновляем игру и улучшаем сервер. Пожалуйста, зайдите немного позже.';
    const confirmText = enabled ? 'Включить техработы? Все обычные игроки увидят полноэкранный экран, игровые действия будут заблокированы.' : 'Выключить техработы и снова открыть игру всем игрокам?';
    if(!await ask(confirmText)) return;
    await run(async()=>{A.maint=await api('/api/admin/maintenance',{enabled,message}); note(enabled?'🔴 Техработы включены':'🟢 Игра открыта'); await loaders.dash();});
    repaint();
  }

  /* ---------- вкладка «Игроки» ---------- */
  function playersV() {
    const L = A.list;
    const flts = [['all', 'Все'], ['live', '🟢 Сейчас'], ['online', 'За 15 мин'], ['blocked', '🚫 Заблок.'], ['new', '🆕 Новые']];
    const sorts = [['last_seen', 'По активности'], ['coins', 'По монетам'], ['xp','По опыту'], ['catches','По уловам'], ['created_at', 'По регистрации']];
    const bar = `<div class="panel"><h2>👥 Игроки${L ? ` · ${fmt(L.total)}` : ''}</h2>
      <div class="row"><input id="a_q" placeholder="Поиск: ID, имя, ник" value="${esc(A.q)}" onkeydown="if(event.key==='Enter')Admin.search()"><button onclick="Admin.search()">Найти</button></div>
      <div class="row" style="margin-top:8px">${flts.map(([k, t]) => `<button class="chip sm ${A.flt === k ? 'on' : ''}" onclick="Admin.setFlt('${k}')">${t}</button>`).join('')}
        <select style="width:auto" onchange="Admin.setSort(this.value)">${sorts.map(([k, t]) => `<option value="${k}" ${A.sort === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
    if (!L) return bar + '<div class="splash"><div class="spin"></div></div></div>';
    const rows = L.players.map(p => `<div class="prow ${p.blocked ? 'bl' : ''}" onclick="Admin.open(${p.telegram_id})">
        <span class="av">${esc(p.avatar || '🏠')}</span>
        <div class="grow"><b>${esc(p.nickname || p.telegram_name)}${p.blocked ? ' 🚫' : ''}${p.telegram_id === L.admin_id ? ' 🛡️' : ''}</b>
          <span class="m">ID ${p.telegram_id} · ур. ${p.level} · ${fmt(p.catches)} уловов</span></div>
        <div class="r"><b>$ ${p.coins >= 1e14 ? '∞' : fmt(p.coins)}</b><div class="m">${ago(p.last_seen)}</div></div></div>`).join('')
      || '<p class="m">Никого не нашли</p>';
    const from = L.total ? A.page * PAGE + 1 : 0, to = Math.min(L.total, (A.page + 1) * PAGE);
    return `${bar}${rows}<div class="pager"><button class="ghost sm" onclick="Admin.page(-1)" ${A.page === 0 ? 'disabled' : ''}>← Назад</button>
      <span class="m">${from}–${to} из ${fmt(L.total)}</span><button class="ghost sm" onclick="Admin.page(1)" ${to >= L.total ? 'disabled' : ''}>Далее →</button></div></div>`;
  }
  const search = () => { syncQ(); A.page = 0; load(); };
  const setFlt = f => { syncQ(); A.flt = f; A.page = 0; load(); };
  const setSort = s => { syncQ(); A.sort = s; A.page = 0; load(); };
  const page = d => { syncQ(); A.page = Math.max(0, A.page + d); load(); };

  /* ---------- карточка игрока (всплывающее окно) ---------- */
  async function open(id) { await run(async () => { A.card = await api('/api/admin/player?id=' + id); }); repaint(); }
  const close = () => { A.card = null; repaint(); };
  /** Перечитывает карточку и список после действия. */
  async function refresh() {
    A.card = await api('/api/admin/player?id=' + A.card.telegram_id);
    if (A.sub === 'players') await loaders.players();
  }

  function cardV() {
    const c=A.card,id=c.telegram_id,f=c.fishing;
    const kv=(k,v)=>`<div><small>${k}</small><b>${v}</b></div>`;
    const fld=(label,key)=>`<div class="fld"><span class="m">${label}</span><input id="ac_${key}" type="number" step="1" placeholder="Количество"><button class="sm" onclick="Admin.actInput(${id},'${key}_add')">±</button><button class="ghost sm" onclick="Admin.actInput(${id},'${key}_set')">＝</button></div>`;
    const all=[['gear','Снасти',f.gear],['fish','Рыба',f.fish],['find','Находки',f.finds],['case','Кейсы',f.cases.filter(x=>x.amount>0)]];
    return `<div class="modal" role="dialog" aria-modal="true" aria-label="Карточка игрока" onclick="if(event.target===this)Admin.close()"><div>
      <div class="row"><div class="grow"><div class="brand">ПРОФИЛЬ ИГРОКА</div><h3>${esc(c.avatar==='🏠'?'🎣':c.avatar)} ${esc(c.nickname||c.telegram_name)}</h3><small>ID ${id}</small></div><button class="ghost sm" onclick="Admin.close()">✕</button></div>
      ${c.blocked?`<p class="bad">Заблокирован: ${esc(c.reason)}</p>`:''}
      <div class="kv">${kv('Доллары',fmt(c.coins))}${kv('Уровень',f.level.level)}${kv('Опыт',fmt(f.level.xp))}${kv('До уровня',fmt(f.level.next_xp-f.level.level_xp)+' EXP')}${kv('Забросы',fmt(f.progress.casts))}${kv('Уловы',fmt(f.progress.catches))}${kv('Коллекция',f.discovered.length+' / '+f.catalog.fish.length)}${kv('Рекорд',f.best_kg+' кг')}${kv('Кейсов открыто',f.cases.reduce((n,x)=>n+x.opened,0))}${kv('Регистрация',date(c.created_at))}${kv('Был онлайн',ago(c.last_seen))}${kv('Попытки',f.attempts.remaining+' / 5')}</div>
      <h2>Баланс и опыт</h2>${fld('Доллары','coins')}${fld('EXP','xp')}<p class="m">± прибавляет или списывает, ＝ задаёт точное значение.</p>
      <div class="acts"><button class="sm" onclick="Admin.act(${id},'coins_add','1000')">+1 000 $</button><button class="sm" onclick="Admin.act(${id},'xp_add','100')">+100 EXP</button><button class="ghost sm" onclick="Admin.act(${id},'cooldown')">Сбросить таймер</button><button class="ghost sm" onclick="Admin.act(${id},'end_cast')">Завершить заброс</button></div>
      <h2 style="margin-top:24px">Выдать или забрать предмет</h2><div class="row"><select id="grant-kind" onchange="Admin.grantOptions()"><option value="gear">Снаряжение</option><option value="fish">Рыба</option><option value="find">Находки</option><option value="case">Кейсы</option></select><select id="grant-key">${f.catalog.gear.map(g=>`<option value="${g.key}">${esc(g.name)}</option>`).join('')}</select></div><div class="row"><input id="grant-count" type="number" step="1" placeholder="Количество: 1 или −1"><button onclick="Admin.grant()">Применить</button></div>
      <h2 style="margin-top:24px">🍀 Временная удача</h2><p class="m">${f.buff.active?'Активен ×'+f.buff.multiplier+' · до '+date(f.buff.expires_at):'Нет активного бонуса'}</p><div class="row"><select id="luck-factor"><option value="2">×2</option><option value="3">×3</option><option value="5">×5</option></select><input id="luck-minutes" type="number" min="1" max="43200" value="30" placeholder="Минуты"></div><div class="acts"><button onclick="Admin.luck(false)">Выдать клевер</button><button class="ghost" onclick="Admin.luck(true)">Снять бонус</button></div><p class="m">Умножает веса эпических и более редких рыб и снастей. Новая выдача заменяет прежний бонус.</p>
      <h2 style="margin-top:24px">Снаряжение на игроке</h2><div class="loadout-mini">${Object.entries(f.progress.equipment).map(([slot,key])=>`<span class="tag">${esc(labels[slot==='tackle'?'bait':slot])}: ${esc(f.catalog.gear.find(g=>g.key===key)?.name||'не выбрано')}</span>`).join('')}</div>
      ${all.map(([k,title,items])=>`<details><summary>${title} · ${items.reduce((n,i)=>n+i.amount,0)}</summary>${items.map(i=>`<div class="admin-inventory-row"><span>${esc(i.icon||'📦')} ${esc(i.name)}</span><b>×${i.amount}</b></div>`).join('')||'<p class="m">Пусто</p>'}</details>`).join('')}
      <h2 style="margin-top:24px">Блокировка</h2><div class="row"><input id="ac_reason" maxlength="100" value="${esc(c.reason||'')}" placeholder="Причина"><button class="${c.blocked?'':'red'} sm" onclick="Admin.act(${id},'${c.blocked?'unblock':'block'}',$('ac_reason').value)" ${c.is_admin?'disabled':''}>${c.blocked?'Разблокировать':'Заблокировать'}</button></div>
      <h2 style="margin-top:24px">Личное сообщение от бота</h2><textarea id="ac_msg" maxlength="1000" placeholder="Текст сообщения"></textarea><button class="sm" onclick="Admin.sendMsg(${id})">Отправить игроку</button>
      <h2 style="margin-top:24px">Сброс данных</h2><div class="acts"><button class="red sm" onclick="Admin.danger(${id},'clear_bag','Удалить всю рыбу и находки этого игрока?')">Очистить рюкзак</button>${!c.is_admin?`<button class="red sm" onclick="Admin.danger(${id},'reset','Полностью сбросить прогресс игрока, деньги и инвентарь?')">Сбросить аккаунт</button>`:''}</div>
    </div></div>`;
  }
  async function luck(remove){const multiplier=remove?1:Number($('luck-factor').value),minutes=remove?1:Number($('luck-minutes').value);await run(async()=>{A.card=await api('/api/admin/players/'+A.card.telegram_id+'/luck',{multiplier,minutes});if(A.card.telegram_id===S.player.telegram_id)accept(await api('/api/fishing/state'));note(remove?'Клевер отключён':'Клевер выдан','success');repaint();});}
  function grantOptions(){const f=A.card.fishing,k=$('grant-kind').value,items={gear:f.catalog.gear,fish:f.catalog.fish,find:f.catalog.finds,case:f.cases}[k];$('grant-key').innerHTML=items.map(g=>`<option value="${g.key}">${esc(g.name)}</option>`).join('');}
  async function grant(){const raw=$('grant-count').value,n=Number(raw);if(!raw||!Number.isSafeInteger(n)||n===0)return note('Введи целое ненулевое количество','error');await run(async()=>{await api('/api/admin/players/'+A.card.telegram_id,{kind:$('grant-kind').value,key:$('grant-key').value,delta:n});if(A.card.telegram_id===S.player.telegram_id)accept(await api('/api/fishing/state'));await refresh();note('Инвентарь обновлён','success');});repaint();}

  /** Выполняет действие над игроком и обновляет карточку. v — значение (число / ID машины / причина). */
  async function act(id, a, v = '') {
    await run(async () => {
      await api('/api/admin/act', {telegram_id: id, act: a, value: String(v ?? '')});
      note('✅ Готово');
      await refresh();
      if (id === S.player.telegram_id) accept(await api('/api/fishing/state'));   // если правим себя — обновляем и свой баланс
    });
    repaint();
  }
  /** Действие со значением из поля ввода ac_<имя>. */
  const actInput = (id, a) => {
    const v = $('ac_' + a.split('_')[0]).value.trim();
    if (v === '') return note('Введи число');
    act(id, a, v);
  };
  /** Опасное действие — с подтверждением. */
  const danger = async (id, a, text) => { if (await ask(text)) act(id, a); };
  async function sendMsg(id) {
    const text = $('ac_msg').value.trim();
    if (!text) return note('Введи текст');
    await run(async () => { await api('/api/admin/message', {telegram_id: id, text}); note('✅ Отправлено'); $('ac_msg').value = ''; });
  }

  /* ---------- вкладка «Рассылка» ---------- */
  function bcV() {
    const b = A.bc, pct = b && b.total ? Math.round((b.sent + b.failed) / b.total * 100) : 0;
    return `<div class="panel"><h2>📣 Рассылка всем игрокам</h2>
      <p class="m">Получат все не заблокированные игроки (кто не останавливал бота). Скорость — около 20 сообщений в секунду.</p>
      <textarea id="bc_text" maxlength="1000" placeholder="Текст сообщения…">${esc(A.bcText)}</textarea>
      <button class="full" style="margin-top:8px" onclick="Admin.sendBc()" ${b?.running ? 'disabled' : ''}>${b?.running ? 'Идёт рассылка…' : 'Отправить всем'}</button>
      ${b && b.total ? `<div class="prog"><i style="width:${pct}%"></i></div><p class="m">Доставлено ${b.sent} из ${b.total} · ошибок ${b.failed}${b.running ? '' : ' · завершено'}</p>` : ''}</div>`;
  }
  async function sendBc() {
    const text = $('bc_text').value.trim();
    if (!text) return note('Введи текст');
    if (!await ask('Отправить сообщение ВСЕМ игрокам?')) return;
    await run(async () => {
      const r = await api('/api/admin/broadcast', {text});
      A.bcText = ''; note(`✅ Рассылка запущена: ${r.total} чел.`);
      A.bc = await api('/api/admin/broadcast'); pollBc();
    });
    repaint();
  }
  /** Пока рассылка идёт и открыта её вкладка — раз в 2 с обновляем прогресс. */
  function pollBc() {
    clearTimeout(A.timer);
    if (A.sub !== 'bc' || tab !== 'admin' || !A.bc?.running) return;
    A.timer = setTimeout(async () => {
      await run(async () => { A.bc = await api('/api/admin/broadcast'); });
      repaint(); pollBc();
    }, 2000);
  }

  /* ---------- вкладка «Журнал» ---------- */
  function logV() {
    if (!A.log) return '<div class="panel splash"><div class="spin"></div></div>';
    return `<div class="panel"><h2>📜 Журнал действий</h2>${A.log.length ? `<table class="log">${A.log.map(l =>
      `<tr><td class="m">${date(l.ts)}</td><td>${l.target ? 'ID ' + l.target : 'все'}</td><td><b>${esc(ACT_NAMES[l.action] || l.action)}</b></td><td class="m">${esc(l.value || '')}</td></tr>`).join('')}</table>`
      : '<p class="m">Пока пусто</p>'}<button class="ghost sm" style="margin-top:10px" onclick="Admin.load()">Обновить</button></div>`;
  }

  function casesV(){
    if(!A.cases)return '<div class="panel splash"><div class="spin"></div>Загрузка кейсов…</div>';
    return `${banner()}<section class="panel"><h2>Кейсы · состав и вероятности</h2><p class="m">У каждой снасти свой вес выпадения. Вероятность = её вес / сумма весов. Ноль исключает предмет. Изменения сохраняются на сервере и сразу применяются к новым открытиям.</p>${A.cases.cases.map(c=>{const ws=Object.fromEntries(c.items.map((k,i)=>[k,c.weights[i]]));return `<details class="case-editor"><summary>📦 ${esc(c.name)} <span class="tag">${fmt(c.price)} $</span></summary><div class="row"><label class="grow">Цена<input id="case-price-${c.key}" type="number" min="0" max="1000000000" value="${c.price}"></label><label>Доступность<select id="case-enabled-${c.key}"><option value="true" ${c.enabled?'selected':''}>В продаже</option><option value="false" ${!c.enabled?'selected':''}>Закрыт</option></select></label></div><div class="chance-legend"><span>Предмет</span><span>Вес / шанс</span></div>${Object.entries(S.catalog.rarities).map(([rar,title])=>`<details><summary>${esc(title)}</summary>${A.cases.gear.filter(g=>g.rarity===rar).map(g=>`<div class="chance-row"><span>${esc(g.icon)} ${esc(g.name)}</span><input type="number" min="0" max="1000000" step="any" class="case-weight" data-case="${c.key}" data-gear="${g.key}" value="${ws[g.key]||0}" aria-label="Вес ${esc(g.name)}" oninput="Admin.chancePreview('${c.key}')"><b data-chance="${c.key}:${g.key}">${((ws[g.key]||0)/c.weights.reduce((a,b)=>a+b,0)*100).toFixed(6)}%</b></div>`).join('')}</details>`).join('')}<p class="m" id="case-sum-${c.key}">Настройте веса и сохраните</p><button class="full" onclick="Admin.saveCase('${c.key}')">Сохранить настройки ${esc(c.name)}</button></details>`}).join('')}</section>`;
  }
  function chancePreview(key){const inputs=[...document.querySelectorAll('.case-weight')].filter(e=>e.dataset.case===key),total=inputs.reduce((n,e)=>n+Math.max(0,Number(e.value)||0),0);inputs.forEach(e=>{const out=document.querySelector(`[data-chance="${key}:${e.dataset.gear}"]`);if(out)out.textContent=(total?Math.max(0,Number(e.value)||0)/total*100:0).toFixed(6)+'%'});$('case-sum-'+key).textContent=total?'Сумма весов без клевера: '+total+' · итоговые шансы: 100%':'Нужна хотя бы одна награда';}
  async function saveCase(key){await run(async()=>{const weights={};for(const e of document.querySelectorAll('.case-weight'))if(e.dataset.case===key)weights[e.dataset.gear]=Number(e.value);await api('/api/admin/cases/'+key,{price:Number($('case-price-'+key).value),enabled:$('case-enabled-'+key).value==='true',weights});await loaders.cases();accept(await api('/api/fishing/state'));note('Шансы и цена сохранены','success');repaint();});}

  /* ---------- главный экран панели ---------- */
  function view() {
    const tabs = [['dash', '◫ Сводка'], ['live', '● Онлайн'], ['players', '👥 Игроки'], ['cases','📦 Кейсы'], ['works', '⚠ Техработы'], ['bc', '📣 Рассылка'], ['log', '≡ Журнал']];
    const nav = `<div class="sub">${tabs.map(([k, t]) => `<button class="chip ${A.sub === k ? 'on' : ''}" onclick="Admin.setSub('${k}')">${t}</button>`).join('')}</div>`;
    return nav + {dash: dashV, live:liveV, players: playersV, works:worksV, cases:casesV, bc: bcV, log: logV}[A.sub]() + (A.card ? cardV() : '');
  }

  // На открытой вкладке сводки или онлайна статистика обновляется без перезагрузки страницы.
  setInterval(async()=>{
    if(tab!=='admin' || document.visibilityState!=='visible' || A.card || A.autoBusy || !['dash','live'].includes(A.sub)) return;
    A.autoBusy=true;
    try { await loaders[A.sub](); repaint(); } catch (_) { /* разовый сетевой сбой — не стираем старые данные */ }
    finally { A.autoBusy=false; }
  },12000);
  return {view, load, setSub, search, setFlt, setSort, page, open, close, act, actInput, danger, sendMsg, sendBc, toggleMaintenance, luck, grantOptions, grant, chancePreview, saveCase};
})();
