/* ============================================================ BuildHouse — админ-панель (клиент)
   Загружается только администратору (см. go('admin') в app.js). Использует глобальные $, api, esc, fmt, note, ask, run, paint.
   Вкладки: Сводка · Игроки (поиск/фильтры/сортировка/страницы + карточка) · Рассылка · Журнал. */
window.Admin = (() => {
  const PAGE = 25;                                   // игроков на странице
  // Состояние панели
  const A = {sub: 'dash', stats: null, list: null, q: '', flt: 'all', sort: 'last_seen', page: 0,
             card: null, log: null, bc: null, bcText: '', timer: null, live: null, maint: null, autoBusy: false};

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
          ${kpi('МОНЕТЫ ИГРОКОВ','$'+fmt(st.coins_total))}
          ${kpi('ЗВЁЗДЫ ИГРОКОВ','⭐ '+fmt(st.gems_total))}
          ${kpi('ИГРЫ / ПОБЕДЫ',fmt(st.games_played)+' / '+fmt(st.games_won))}
          ${kpi('ТАПОВ',fmt(st.taps))}
          ${kpi('МАШИН',fmt(st.cars))}
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
        <div class="panel"><h2>ПОПУЛЯРНОСТЬ УРОВНЕЙ ДОМОВ</h2>
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
      <div class="kpi" style="margin-top:14px"><div><small>СЕЙЧАС В ИГРЕ</small><b>${fmt(L.count)}</b></div><div><small>АКТИВНЫЕ «МИНЫ»</small><b>${fmt(L.active_mines)}</b></div><div><small>ПОСЛЕДНЯЯ ПРОВЕРКА</small><b style="font-size:15px">${date(L.updated_at)}</b></div></div>
      <div style="margin-top:16px">${L.online.length ? L.online.map(p => `<div class="live-row" onclick="Admin.open(${p.telegram_id})"><span class="av">${esc(p.avatar||'👤')}</span><div class="grow"><b><span class="live-dot"></span>${esc(p.nickname || p.telegram_name)}</b><small>ID ${p.telegram_id} · дом ${p.house} · ${p.blocked?'Заблокирован':'активен'}</small></div><div style="text-align:right"><b>$${fmt(p.coins)}</b><div class="m">${ago(p.last_seen)}</div></div></div>`).join(''):'<div class="panel"><p class="m">Сейчас нет активных игроков. Они появятся здесь после открытия Mini App.</p></div>'}</div>
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
    const sorts = [['last_seen', 'По активности'], ['coins', 'По $'], ['gems', 'По ⭐'], ['house', 'По дому'], ['earned', 'По заработку'], ['created_at', 'По регистрации']];
    const bar = `<div class="panel"><h2>👥 Игроки${L ? ` · ${fmt(L.total)}` : ''}</h2>
      <div class="row"><input id="a_q" placeholder="Поиск: ID, имя, ник" value="${esc(A.q)}" onkeydown="if(event.key==='Enter')Admin.search()"><button onclick="Admin.search()">Найти</button></div>
      <div class="row" style="margin-top:8px">${flts.map(([k, t]) => `<button class="chip sm ${A.flt === k ? 'on' : ''}" onclick="Admin.setFlt('${k}')">${t}</button>`).join('')}
        <select style="width:auto" onchange="Admin.setSort(this.value)">${sorts.map(([k, t]) => `<option value="${k}" ${A.sort === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
    if (!L) return bar + '<div class="splash"><div class="spin"></div></div></div>';
    const rows = L.players.map(p => `<div class="prow ${p.blocked ? 'bl' : ''}" onclick="Admin.open(${p.telegram_id})">
        <span class="av">${esc(p.avatar || '🏠')}</span>
        <div class="grow"><b>${esc(p.nickname || p.telegram_name)}${p.blocked ? ' 🚫' : ''}${p.telegram_id === L.admin_id ? ' 🛡️' : ''}</b>
          <span class="m">ID ${p.telegram_id} · дом ${p.house ?? 1} · ⭐${fmt(p.gems)}</span></div>
        <div class="r"><b>$${p.coins >= 1e14 ? '∞' : fmt(p.coins)}</b><div class="m">${ago(p.last_seen)}</div></div></div>`).join('')
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
    const c = A.card, id = c.telegram_id, self = c.is_admin;
    const kv = (k, v) => `<div><small>${k}</small>${v}</div>`;
    const fld = (label, key) => `<div class="fld"><span class="m">${label}</span><input id="ac_${key}" type="number" inputmode="numeric" placeholder="число (минус — списать)">
        <button class="sm" onclick="Admin.actInput(${id},'${key}_add')">＋</button><button class="ghost sm" onclick="Admin.actInput(${id},'${key}_set')">＝</button></div>`;
    const cat = A.stats?.catalog || [];
    return `<div class="modal" onclick="if(event.target===this)Admin.close()"><div>
      <div class="row"><div style="flex:1;min-width:0"><h3>${esc(c.avatar || '🏠')} ${esc(c.nickname || c.telegram_name)}${self ? ' 🛡️' : ''}</h3>
        <span class="m">${esc(c.telegram_name)} · ID ${id}</span></div><button class="ghost sm" onclick="Admin.close()">✕</button></div>
      ${c.blocked ? `<p class="bad">🚫 Заблокирован${c.reason ? ': ' + esc(c.reason) : ''}</p>` : ''}
      <div class="kv">${kv('Доллары', '$' + (c.coins >= 1e14 ? '∞' : fmt(c.coins)))}${kv('Звёзды', '⭐' + (c.gems >= 1e14 ? '∞' : fmt(c.gems)))}
        ${kv('Дом', `${c.house ?? 1} ур. · ${esc(c.house_name)}`)}${kv('Энергия', Math.round(c.energy ?? 0))}${kv('Игр / побед', `${c.games_played} / ${c.games_won}`)}
        ${kv('Тапов', fmt(c.taps))}${kv('Заработано', '$' + fmt(c.earned))}${kv('Машин', c.cars_total)}${kv('Регистрация', date(c.created_at))}
        ${kv('Был онлайн', ago(c.last_seen))}${kv('Бонус дня', Date.now() / 1000 - c.last_daily >= 86400 ? 'доступен' : 'получен')}
        ${kv('Рыбалка: уловы', fmt(c.fishing_catches||0))}${kv('Рыба в рюкзаке', fmt(c.fishing_fish||0))}${kv('Находки', fmt(c.fishing_finds||0))}
        ${kv('Мины', c.game ? `ставка $${fmt(c.game.bet)}, мин ${c.game.mines}, ${esc(c.game.status)}` : '—')}</div>
      <h2>Баланс и дом</h2>${fld('$', 'coins')}${fld('⭐', 'gems')}${fld('Дом', 'house')}
      <div class="acts"><button class="sm" onclick="Admin.act(${id},'coins_add','10000')">+$10k</button><button class="sm" onclick="Admin.act(${id},'coins_add','1000000')">+$1M</button>
        <button class="sm" onclick="Admin.act(${id},'gems_add','10')">+⭐10</button><button class="sm" onclick="Admin.act(${id},'gems_add','100')">+⭐100</button>
        <button class="sm" onclick="Admin.act(${id},'house_add','1')">Дом +1</button>
        <button class="ghost sm" onclick="Admin.act(${id},'refill_energy')">⚡ Энергия</button><button class="ghost sm" onclick="Admin.act(${id},'daily_reset')">🎁 Сброс бонуса</button>
        <button class="ghost sm" onclick="Admin.act(${id},'end_game')">💣 Сброс игры</button></div>
      <h2 style="margin-top:14px">Гараж</h2>
      ${c.cars.map(x => `<div class="m">${x.parked ? '🅿️' : '🚗'} ${esc(x.name)} · $${fmt(x.value)}</div>`).join('') || '<p class="m">Гараж пуст</p>'}
      <div class="row" style="margin-top:8px"><select id="ac_car"><option value="">🎲 Случайная машина</option>${cat.map(x => `<option value="${x.idx}">${esc(x.name)} — $${fmt(x.value)}</option>`).join('')}</select>
        <button class="sm" onclick="Admin.act(${id},'give_car',$('ac_car').value)">Подарить</button></div>
      <h2 style="margin-top:14px">Блокировка</h2>
      <div class="row"><input id="ac_reason" maxlength="100" placeholder="Причина (необязательно)" value="${esc(c.reason || '')}">
        ${c.blocked ? `<button class="sm" onclick="Admin.act(${id},'unblock')">Разблокировать</button>`
                    : `<button class="red sm" onclick="Admin.act(${id},'block',$('ac_reason').value)" ${self ? 'disabled' : ''}>Заблокировать</button>`}</div>
      <h2 style="margin-top:14px">Сообщение от бота</h2>
      <textarea id="ac_msg" maxlength="1000" placeholder="Текст сообщения…"></textarea>
      <button class="sm" style="margin-top:6px" onclick="Admin.sendMsg(${id})">Отправить</button>
      ${self ? '' : `<h2 style="margin-top:14px">Опасная зона</h2><div class="acts"><button class="red sm" onclick="Admin.danger(${id},'clear_garage','Очистить гараж игрока?')">Очистить гараж</button>
        <button class="red sm" onclick="Admin.danger(${id},'reset','Полностью сбросить аккаунт? Это необратимо.')">Сбросить аккаунт</button></div>`}
    </div></div>`;
  }

  /** Выполняет действие над игроком и обновляет карточку. v — значение (число / ID машины / причина). */
  async function act(id, a, v = '') {
    await run(async () => {
      await api('/api/admin/act', {telegram_id: id, act: a, value: String(v ?? '')});
      note('✅ Готово');
      await refresh();
      if (id === S.player.telegram_id) setS(await api('/api/bh/state'));   // если правим себя — обновляем и свой баланс
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

  /* ---------- главный экран панели ---------- */
  function view() {
    const tabs = [['dash', '◫ Сводка'], ['live', '● Онлайн'], ['players', '👥 Игроки'], ['works', '⚠ Техработы'], ['bc', '📣 Рассылка'], ['log', '≡ Журнал']];
    const nav = `<div class="sub">${tabs.map(([k, t]) => `<button class="chip ${A.sub === k ? 'on' : ''}" onclick="Admin.setSub('${k}')">${t}</button>`).join('')}</div>`;
    return nav + {dash: dashV, live:liveV, players: playersV, works:worksV, bc: bcV, log: logV}[A.sub]() + (A.card ? cardV() : '');
  }

  // На открытой вкладке сводки или онлайна статистика обновляется без перезагрузки страницы.
  setInterval(async()=>{
    if(tab!=='admin' || document.visibilityState!=='visible' || A.card || A.autoBusy || !['dash','live'].includes(A.sub)) return;
    A.autoBusy=true;
    try { await loaders[A.sub](); repaint(); } catch (_) { /* разовый сетевой сбой — не стираем старые данные */ }
    finally { A.autoBusy=false; }
  },12000);
  return {view, load, setSub, search, setFlt, setSort, page, open, close, act, actInput, danger, sendMsg, sendBc, toggleMaintenance};
})();
