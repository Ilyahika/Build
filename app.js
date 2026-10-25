/* ============================================================ Viva — клиент (Telegram Mini App)
   Разделы: 1 настройки и утилиты · 2 запросы к серверу · 3 запуск · 4 экраны · 5 действия
   Экран загрузки и диагностика живут в index.html (загрузчик), здесь — само приложение. */
window.__appStarted = true;

/* ---------- 1. Настройки и утилиты ---------- */
const API_BASE = (document.querySelector('meta[name="api-base"]')?.content || '').trim().replace(/\/$/, '');
const VER = new URLSearchParams(document.currentScript?.src.split('?')[1] || '').get('v') || '1';
let tg = window.__tg || window.Telegram?.WebApp;
if (tg) { tg.ready?.(); tg.expand?.(); tg.disableVerticalSwipes?.(); }

const dbg = (...a) => window.__dbg && window.__dbg(...a);   // запись в экранную диагностику
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmt = n => Number(n ?? 0).toLocaleString('ru-RU');
const inf = n => n >= 1e14 ? '∞' : fmt(n);                 // огромные балансы админа показываем как ∞
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const AVATARS = ['🎣', '🐟', '🐠', '🦈', '🐙', '⚓', '🚤', '🦆', '🐳', '🦀'];
const avatarOf = a => (!a || a === '🏠') ? '🎣' : a;        // у старых игроков стоял 🏠

let S = null;                    // состояние игрока с сервера
let tab = 'fish', sub = null;    // текущая вкладка (sub нужен админ-панели)
let busy = false, lastSync = 0;
let maintenanceActive = false, systemChecking = false;

/** Всплывающее уведомление внизу экрана. */
function note(msg) {
  const el = $('status');
  el.textContent = msg;
  clearTimeout(note.t);
  note.t = setTimeout(() => { el.textContent = ''; }, 4000);
}
/** Подтверждение: окно Telegram или обычный confirm. */
const ask = text => new Promise(res => (tg?.showConfirm && tg.isVersionAtLeast?.('6.2')) ? tg.showConfirm(text, res) : res(confirm(text)));
/** Подгружает JS по требованию (админ-панель — только администратору). */
const loadScript = src => new Promise((ok, fail) => {
  const s = document.createElement('script');
  s.src = src; s.onload = ok; s.onerror = () => fail(new Error('Не удалось загрузить ' + src));
  document.head.appendChild(s);
});

/* ---------- 2. Запросы к серверу ---------- */
class ApiError extends Error {
  constructor(message, status = 0, retry = false) { super(message); this.status = status; this.retry = retry; }
}

/** Запрос к API. body === undefined -> GET, иначе POST (JSON). У каждого запроса есть таймаут. */
async function api(path, body, {timeout = 15000, retries = 0} = {}) {
  if (!tg?.initData) throw new ApiError('Открой приложение кнопкой «Открыть» в Telegram, а не в браузере.');
  const init = {
    method: body === undefined ? 'GET' : 'POST', cache: 'no-store',
    headers: {'X-Telegram-Init-Data': tg.initData, ...(body === undefined ? {} : {'Content-Type': 'application/json'})},
    body: body === undefined ? undefined : JSON.stringify(body)};
  for (let attempt = 0; ; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(API_BASE + path, {...init, signal: ctl.signal});
      const j = await r.json().catch(() => ({}));
      if (r.ok) return j;
      if (r.status === 503 && j.detail?.code === 'MAINTENANCE') {
        showMaintenance(j.detail.message);
        throw new ApiError('В игре проводятся технические работы', 503, false);
      }
      const msg = typeof j.detail === 'string' ? j.detail : `Ошибка сервера ${r.status}`;
      throw new ApiError(msg, r.status, r.status >= 502 && r.status <= 504);
    } catch (e) {
      const err = e instanceof ApiError ? e
        : new ApiError(e.name === 'AbortError' ? 'Сервер долго не отвечает.' : 'Нет связи с сервером (он мог уснуть — подожди минуту).', 0, true);
      if (!err.retry || attempt >= retries || body !== undefined) throw err;   // POST не повторяем
      await sleep(1500 * (attempt + 1));
    } finally { clearTimeout(timer); }
  }
}

/** Выполняет функцию и показывает ошибку уведомлением. */
const run = async fn => { try { return await fn(); } catch (e) { note('⚠️ ' + e.message); } };

/** Принимает свежее состояние от сервера. */
function setS(r) { S = r; lastSync = Date.now(); }

/** POST к /api/bh/<path>: блокирует повторные клики, обновляет состояние и экран. */
async function post(path, body = {}) {
  if (busy) return null;
  busy = true; document.body.classList.add('busy');
  let r = null;
  try { r = await api('/api/bh/' + path, body); setS(r); }
  catch (e) { note('⚠️ ' + e.message); }
  finally { busy = false; document.body.classList.remove('busy'); }
  paint();
  return r;
}


/* ---------- Техработы: сервер управляет доступом, экран только показывает состояние ---------- */
function showMaintenance(message) {
  maintenanceActive = true;
  const el = $('maintenanceScreen');
  if (!el) return;
  $('maintenanceMessage').textContent = message || 'В игре проводятся технические работы.';
  el.hidden = false;
  document.body.classList.add('maintenance-mode');
  window.__appReady = true;
  window.__hideBoot?.();
}
function hideMaintenance() {
  maintenanceActive = false;
  const el = $('maintenanceScreen');
  if (el) el.hidden = true;
  document.body.classList.remove('maintenance-mode');
}

async function pollSystem() {
  if (systemChecking || !tg?.initData || document.visibilityState !== 'visible') return;
  systemChecking = true;
  try {
    const state = await api('/api/system/status', undefined, {timeout: 10000});
    if (state.enabled && !state.is_admin) {
      showMaintenance(state.message);
    } else {
      const wasOn = maintenanceActive;
      hideMaintenance();
      if (wasOn || !S) {
        setS(await api('/api/bh/state', undefined, {timeout: 15000}));
        paint();
        window.__appReady = true;
        window.__hideBoot?.();
      }
    }
  } catch (err) {
    // Временная потеря сети не должна выключать экран техработ.
    if (!maintenanceActive && !S) dbg('system', 'Состояние игры', 'warn', err.message);
  } finally { systemChecking = false; }
}
setInterval(pollSystem, 10000);

/* ---------- 3. Запуск ---------- */
/** Простой запрос с таймаутом для проверок (не бросает исключений). */
async function probe(path, headers = {}, timeout = 8000) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeout), t = Date.now();
  try {
    const r = await fetch(API_BASE + path, {signal: ctl.signal, cache: 'no-store', headers});
    const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch (_) {}
    return {ok: r.ok, status: r.status, ms: Date.now() - t, json, text: text.slice(0, 200)};
  } catch (e) { return {err: e.name === 'AbortError' ? `таймаут ${timeout / 1000} с` : `${e.name}: ${e.message}`, ms: Date.now() - t}; }
  finally { clearTimeout(timer); }
}

/** Старт: «будим» сервер (/health), проверяем БД, получаем профиль. Каждый шаг пишется в диагностику. */
async function boot() {
  const t0 = Date.now();
  if (!tg?.initData) { dbg('init', '4. Данные профиля', 'fail', 'нет данных Telegram — открой приложение кнопкой «Открыть» у бота'); return; }

  const N1 = '4. Сервер (/health)';
  dbg('health', N1, 'wait', 'Подключаемся к серверу…');
  let h = null;
  for (let i = 0; i < 25; i++) {
    h = await probe('/health');
    if (h.ok || h.status) break;
    dbg('health', N1, 'wait', `Сервер просыпается… ${Math.round((Date.now() - t0) / 1000)} с (до минуты)`);
    await sleep(2000);
  }
  if (!h.ok) {
    let hint = h.status ? `сервер ответил HTTP ${h.status}: ${h.text}` : `нет связи: ${h.err}`;
    if (!h.status && API_BASE) {
      try { await fetch(API_BASE + '/health', {mode: 'no-cors', cache: 'no-store'}); hint += ' → адрес достижим, но ответ блокируется (CORS) либо сервер вернул ошибку 502 — проверь Logs на Render'; }
      catch (_) { hint += ' → адрес недоступен: проверь api-base в index.html и что сервис на Render запущен'; }
    }
    dbg('health', N1, 'fail', hint); return;
  }
  dbg('health', N1, 'ok', `ответил за ${h.ms} мс · ${h.json?.version ?? ''}`);

  dbg('db', '5. База данных', 'wait', 'Проверяем базу…');
  const d = await probe('/health/db', {}, 10000);
  if (!d.ok) { dbg('db', '5. База данных', 'fail', d.status ? `HTTP ${d.status}: ${d.text}` : `нет ответа: ${d.err}`); return; }
  dbg('db', '5. База данных', d.json?.tables_ready ? 'ok' : 'warn', d.json?.tables_ready ? 'готова' : 'подключена, но таблицы не готовы: ' + d.text);

  dbg('system', '6. Доступность игры', 'wait', 'Проверяем состояние игры…');
  const sys = await probe('/api/system/status', {'X-Telegram-Init-Data': tg.initData}, 15000);
  if (!sys.ok) {
    dbg('system', '6. Доступность игры', 'fail', `HTTP ${sys.status || 0}: ${sys.json?.detail || sys.err || sys.text}`);
    return;
  }
  if (sys.json?.enabled && !sys.json?.is_admin) {
    dbg('system', '6. Доступность игры', 'ok', 'Проводятся техработы — показан экран обслуживания');
    showMaintenance(sys.json.message);
    return;
  }
  dbg('system', '6. Доступность игры', 'ok', sys.json?.is_admin ? 'Администратор: доступ разрешён' : 'Игра доступна');

  dbg('state', '7. Профиль игрока', 'wait', 'Загружаем профиль…');
  const s = await probe('/api/bh/state', {'X-Telegram-Init-Data': tg.initData}, 20000);
  if (!s.ok) {
    const detail = s.json?.detail || s.text || s.err;
    dbg('state', '7. Профиль игрока', 'fail', `${s.status ? 'HTTP ' + s.status : 'нет ответа'}: ${detail}` +
      (s.status === 401 ? ' → BOT_TOKEN на сервере не принадлежит этому боту (или данные устарели)' : s.status === 503 ? ' → BOT_TOKEN не задан на Render' : ''));
    return;
  }
  dbg('state', '7. Профиль игрока', 'ok', `получен за ${s.ms} мс`);
  try { setS(s.json); paint(); window.__appReady = true; window.__hideBoot && window.__hideBoot(); }
  catch (e) { dbg('paint', 'Отрисовка экрана', 'fail', `${e.name}: ${e.message}`); }
}

/** Вернулись в приложение после долгого отсутствия — обновляем данные. */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') pollSystem();
  if (document.visibilityState === 'visible' && S && !maintenanceActive && Date.now() - lastSync > 30000 && tab !== 'admin') {
    run(async () => { setS(await api('/api/bh/state')); paint(); });
  }
});

/* ---------- 4. Экраны ---------- */
const NAV = [['fish', '🎣', 'Рыбалка'], ['gear', '🪝', 'Снасти'], ['bag', '🎒', 'Рюкзак'], ['settings', '⚙️', 'Настройки']];

/** Перерисовывает верхнюю панель, нижнее меню и текущий экран. */
function paint() {
  if (!S) return;
  document.body.classList.toggle('adm', tab === 'admin');
  const p = S.player;
  $('topbar').innerHTML = `<div class="pro"><div class="ava">${esc(avatarOf(S.avatar))}<em>${S.house.level}</em></div>
      <div class="who"><b>${esc(p.nickname)}</b><small>Уровень ${S.house.level}</small></div></div>
    <div class="wallet"><i>₽</i>${inf(p.coins)}</div>`;
  const items = S.is_admin ? [...NAV, ['admin', '🛡️', 'Админ']] : NAV;
  $('nav').innerHTML = items.map(([k, i, t]) => `<button class="${k === tab ? 'on' : ''}" onclick="go('${k}')"><b>${i}</b>${t}</button>`).join('');
  const views = {
    fish: () => maintV('Рыбалка', 'Скоро здесь можно будет забросить удочку и поймать первую рыбу.'),
    gear: () => maintV('Снасти', 'Удочки, наживка и поплавки появятся здесь.'),
    bag: () => maintV('Рюкзак', 'Улов и найденные вещи будут храниться здесь.'),
    settings: settingsV,
    admin: () => window.Admin ? Admin.view() : '<div class="panel splash"><div class="spin"></div>Загрузка панели…</div>'};
  $('view').innerHTML = views[tab]();
}

/** Заглушка «Технические работы» с картинкой. */
function maintV(title, text) {
  return `<div class="panel maint">
    <svg viewBox="0 0 300 170" aria-hidden="true">
      <defs><clipPath id="mc"><rect x="0" y="95" width="300" height="75" rx="14"/></clipPath></defs>
      <g clip-path="url(#mc)"><rect x="0" y="95" width="300" height="75" fill="#0c4a66"/>
      <path class="wv1" d="M-100 112q30-12 60 0t60 0 60 0 60 0 60 0 60 0 60 0 60 0 60 0V170H-100z" fill="#1fa3c4" opacity=".5"/></g>
      <path d="M70 92h150l-18 22H88z" fill="#8a5a2b"/><path d="M150 92V28l52 52z" fill="#f4f4f4"/><path d="M150 28v64" stroke="#8a5a2b" stroke-width="4"/>
      <circle cx="250" cy="34" r="16" fill="#ffb347" opacity=".9"/>
      <g transform="translate(34 40)"><path d="M0 40l26-26" stroke="#ffb347" stroke-width="9" stroke-linecap="round"/><circle cx="32" cy="8" r="13" fill="none" stroke="#ffb347" stroke-width="7"/></g>
    </svg>
    <h2>🛠 Технические работы</h2>
    <p class="m">${esc(text)}</p><span class="tag">Раздел «${esc(title)}» скоро откроется</span></div>`;
}

/** Настройки: аватар и ник. */
function settingsV() {
  const p = S.player, cur = avatarOf(S.avatar);
  return `<div class="panel"><h2>🎭 Аватар</h2><div class="avs">${AVATARS.map(a => `<button class="${a === cur ? 'on' : ''}" onclick="post('avatar',{avatar:'${a}'})">${a}</button>`).join('')}</div></div>
    <div class="panel"><h2>✏️ Ник</h2><div class="row"><input id="nick" maxlength="24" placeholder="Ник (пусто — имя Telegram)" value="${esc(p.custom_nickname || '')}"><button onclick="saveNick()">Сохранить</button></div></div>
    <div class="panel"><h2>ℹ️ Профиль</h2><div class="row"><span class="tag">ID: <b>${p.telegram_id}</b></span><span class="tag">Уровень: <b>${S.house.level}</b></span></div></div>`;
}

/* ---------- 5. Действия (вызываются из onclick) ---------- */
/** Переход между вкладками. Админ-панель подгружается только администратору. */
async function go(t) {
  tab = t; sub = null; paint();
  if (t === 'admin') run(async () => {
    if (!window.Admin) await loadScript('admin.js?v=' + VER);
    await Admin.load();
  });
}
const saveNick = () => run(async () => {
  setS(await api('/api/nickname', {nickname: $('nick').value})); note('✅ Ник сохранён'); paint();
});

boot();
