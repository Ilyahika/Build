"""Viva Fishing. Virtual fishing with server-side inventory and coin purchases.

Coins are earned in game; no real money payments or withdrawals.
All changes are inside SQLite IMMEDIATE transactions to prevent double-claiming.
"""
from __future__ import annotations

import json
import uuid
import math
import random
import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import current_user
from config import ADMIN_ID
from db import session

router = APIRouter(prefix='/api/fishing', tags=['fishing'])
RNG = random.SystemRandom()
COOLDOWN_SECONDS = 180

RARITIES = dict(common='🖤 Обычный', rare='💙 Редкий', improved='🩵 Улучшенный', epic='💜 Эпический', legendary='💛 Легендарный', mythic='❤️ Мифический', absolute='🤍 Абсолютный')
TIERS = list(RARITIES)

LOCATIONS = [
    {'key':'pond', 'name':'Пруд', 'icon':'🌿', 'subtitle':'Тихий берег', 'description':'Караси, окуни и золотой карп', 'color':'#6dba8a'},
    {'key':'lake', 'name':'Озеро', 'icon':'🏞️', 'subtitle':'Глубокая вода', 'description':'Судак, щука и озёрный призрак', 'color':'#4aaeca'},
    {'key':'sea', 'name':'Море', 'icon':'🌅', 'subtitle':'Солёный прибой', 'description':'Тунец и морские редкости', 'color':'#58bce3'},
    {'key':'ocean', 'name':'Океан', 'icon':'🌊', 'subtitle':'Дальние глубины', 'description':'Марлин и глубинный левиафан', 'color':'#347dbe'},
    {'key':'stream', 'name':'Секретный ручей', 'icon':'✨', 'subtitle':'Таинственное течение', 'description':'Лунный угорь и кристальный карп', 'color':'#b88aee'},
]

# 20 distinct collectible fish: 4 per location. Rarity weights are intentionally
# displayed in the UI; there are no paid rolls or financial stakes.
FISH = [
    {'key':'crucian', 'name':'Карась', 'location':'pond', 'rarity':'common', 'icon':'🐟', 'weight':45, 'value':18},
    {'key':'perch', 'name':'Окунь', 'location':'pond', 'rarity':'common', 'icon':'🐟', 'weight':32, 'value':24},
    {'key':'carp', 'name':'Карп', 'location':'pond', 'rarity':'rare', 'icon':'🐠', 'weight':18, 'value':75},
    {'key':'gold_carp', 'name':'Золотой карп', 'location':'pond', 'rarity':'epic', 'icon':'🐠', 'weight':5, 'value':230},
    {'key':'bream', 'name':'Лещ', 'location':'lake', 'rarity':'common', 'icon':'🐟', 'weight':45, 'value':26},
    {'key':'zander', 'name':'Судак', 'location':'lake', 'rarity':'rare', 'icon':'🐟', 'weight':33, 'value':90},
    {'key':'pike', 'name':'Щука', 'location':'lake', 'rarity':'epic', 'icon':'🐠', 'weight':17, 'value':260},
    {'key':'lake_ghost', 'name':'Озёрный призрак', 'location':'lake', 'rarity':'secret', 'icon':'👻', 'weight':5, 'value':1200},
    {'key':'sardine', 'name':'Сардина', 'location':'sea', 'rarity':'common', 'icon':'🐟', 'weight':45, 'value':32},
    {'key':'mackerel', 'name':'Скумбрия', 'location':'sea', 'rarity':'rare', 'icon':'🐟', 'weight':32, 'value':110},
    {'key':'tuna', 'name':'Тунец', 'location':'sea', 'rarity':'marine', 'icon':'🐬', 'weight':18, 'value':420},
    {'key':'seahorse', 'name':'Морской конёк', 'location':'sea', 'rarity':'epic', 'icon':'🐠', 'weight':5, 'value':310},
    {'key':'clownfish', 'name':'Рыба-клоун', 'location':'ocean', 'rarity':'rare', 'icon':'🐠', 'weight':42, 'value':130},
    {'key':'swordfish', 'name':'Рыба-меч', 'location':'ocean', 'rarity':'epic', 'icon':'🐟', 'weight':33, 'value':360},
    {'key':'marlin', 'name':'Марлин', 'location':'ocean', 'rarity':'marine', 'icon':'🐬', 'weight':20, 'value':650},
    {'key':'leviathan', 'name':'Глубинный левиафан', 'location':'ocean', 'rarity':'secret', 'icon':'🐉', 'weight':5, 'value':2600},
    {'key':'trout', 'name':'Форель', 'location':'stream', 'rarity':'rare', 'icon':'🐟', 'weight':45, 'value':180},
    {'key':'grayling', 'name':'Радужный хариус', 'location':'stream', 'rarity':'epic', 'icon':'🌈', 'weight':31, 'value':530},
    {'key':'moon_eel', 'name':'Лунный угорь', 'location':'stream', 'rarity':'secret', 'icon':'🌙', 'weight':19, 'value':1600},
    {'key':'crystal_carp', 'name':'Кристальный карп', 'location':'stream', 'rarity':'secret', 'icon':'💎', 'weight':5, 'value':3200},
]

FINDS = [
    {'key':'driftwood', 'name':'Коряга', 'rarity':'common', 'icon':'🪵'},
    {'key':'shell', 'name':'Перламутровая ракушка', 'rarity':'rare', 'icon':'🐚'},
    {'key':'old_coin', 'name':'Старинная монета', 'rarity':'rare', 'icon':'🪙'},
    {'key':'pearl', 'name':'Жемчужина', 'rarity':'epic', 'icon':'⚪'},
    {'key':'anchor', 'name':'Забытый якорь', 'rarity':'marine', 'icon':'⚓'},
    {'key':'relic', 'name':'Реликвия глубин', 'rarity':'secret', 'icon':'🔮'},
    {'key':'gold_compass', 'name':'Золотой компас', 'rarity':'exclusive', 'icon':'🧭'},
    {'key':'gold_crown', 'name':'Золотая корона', 'rarity':'exclusive', 'icon':'👑'},
]

GEAR = [
    {'key':'starter_rod', 'type':'rod', 'name':'Бамбуковая удочка', 'rarity':'common', 'icon':'🎣', 'luck':0},
    {'key':'river_rod', 'type':'rod', 'name':'Речная удочка', 'rarity':'rare', 'icon':'🎣', 'luck':0.15},
    {'key':'carbon_rod', 'type':'rod', 'name':'Карбоновый спиннинг', 'rarity':'epic', 'icon':'🎣', 'luck':0.3},
    {'key':'sea_rod', 'type':'rod', 'name':'Морской трезубец', 'rarity':'marine', 'icon':'🔱', 'luck':0.45},
    {'key':'shadow_rod', 'type':'rod', 'name':'Удочка тёмных вод', 'rarity':'secret', 'icon':'🎣', 'luck':0.7},
    {'key':'gold_rod', 'type':'rod', 'name':'Золотая удочка', 'rarity':'exclusive', 'icon':'✨', 'luck':1.0},
    {'key':'starter_lure', 'type':'tackle', 'name':'Простая приманка', 'rarity':'common', 'icon':'🪝', 'luck':0},
    {'key':'silver_hook', 'type':'tackle', 'name':'Серебряный крючок', 'rarity':'rare', 'icon':'🪝', 'luck':0.12},
    {'key':'flash_spinner', 'type':'tackle', 'name':'Мерцающая блесна', 'rarity':'epic', 'icon':'✨', 'luck':0.25},
    {'key':'coral_float', 'type':'tackle', 'name':'Коралловый поплавок', 'rarity':'marine', 'icon':'🪸', 'luck':0.4},
    {'key':'phantom_lure', 'type':'tackle', 'name':'Призрачная приманка', 'rarity':'secret', 'icon':'🔮', 'luck':0.6},
    {'key':'gold_hook', 'type':'tackle', 'name':'Золотой крючок', 'rarity':'exclusive', 'icon':'🏆', 'luck':0.9},
]

# Existing identifiers are retained so inventories survive the upgrade.
for item in FISH + FINDS + GEAR:
    item['rarity'] = {'marine':'legendary','secret':'mythic','exclusive':'absolute'}.get(item['rarity'],item['rarity'])
for i, loc in enumerate(LOCATIONS): loc['level'] = [1,5,10,18,25][i]
FISH_BY_SPECIAL = {'carp':'improved','crystal_carp':'absolute','leviathan':'absolute'}
for fish in FISH: fish['rarity'] = FISH_BY_SPECIAL.get(fish['key'],fish['rarity'])
rod_names = ['Простая удочка','Бамбуковая удочка','Улучшенная удочка','Простой спиннинг','Улучшенный спиннинг','Спортивный спиннинг']
for i, item in enumerate(GEAR[:6]): item.update(name=rod_names[i],rarity=TIERS[i],price=[0,150,600,1800,5000,14000][i])
for item in GEAR[6:]: item.update(type='bait',price=200*(TIERS.index(item['rarity'])+1)**2)
GEAR.append(dict(key='bait_improved',type='bait',name='Силиконовая приманка',icon='🪝',rarity='improved',luck=.18,price=450))
for typ, title, icon in [('reel','Катушка','⚙️'),('line','Леска','🧵'),('spoon','Колебалка','🥄'),('spinner','Вертушка','🌀')]:
    for i, rarity in enumerate(TIERS):
        GEAR.append(dict(key=f'{typ}_{rarity}',type=typ,name=f'{title} · {RARITIES[rarity][2:]}',icon=icon,rarity=rarity,luck=i*.08,price=100*(i+1)**3))
CASES = []
for i,(key,name,price) in enumerate([('shore','Береговой',300),('lake','Озёрный',1200),('marine','Морской',4500),('secret','Глубинный',12000)]):
    pool=[g for g in GEAR if max(0,i-1)<=TIERS.index(g['rarity'])<=min(6,i+3)]
    weights=[max(1,70//(1+TIERS.index(g['rarity']))**2) for g in pool]
    CASES.append(dict(key=key,name=name+' кейс',icon='📦',price=price,items=[g['key'] for g in pool],weights=weights))

def level_info(xp):
    level=1; need=100; rest=xp
    while rest>=need:
        rest-=need; level+=1; need=100+50*(level-1)
    return dict(level=level,xp=xp,level_xp=rest,next_xp=need)

FISH_BY_ID = {r['key']: r for r in FISH}
FINDS_BY_ID = {r['key']: r for r in FINDS}
GEAR_BY_ID = {r['key']: r for r in GEAR}
LOC_BY_ID = {r['key']: r for r in LOCATIONS}
CASE_BY_ID = {r['key']: r for r in CASES}


def ensure_fishing(db, uid: int):
    """Create missing progress and free starter gear without touching existing balances."""
    created=db.execute('INSERT OR IGNORE INTO fishing_progress (telegram_id) VALUES (?)', (uid,)).rowcount
    if not created: return
    db.execute('INSERT OR IGNORE INTO fishing_gear (telegram_id, gear_key, amount) VALUES (?,?,1)', (uid, 'starter_rod'))
    db.execute('INSERT OR IGNORE INTO fishing_gear (telegram_id, gear_key, amount) VALUES (?,?,1)', (uid, 'starter_lure'))


def inventory(db, table: str, uid: int, catalog: dict):
    return [{**catalog[r['item_key']], 'amount':r['amount']} for r in db.execute(
        f'SELECT item_key, amount FROM {table} WHERE telegram_id=? AND amount>0', (uid,))
        if r['item_key'] in catalog]


def snapshot(db, uid: int) -> dict:
    p = db.execute('SELECT * FROM fishing_progress WHERE telegram_id=?', (uid,)).fetchone()
    caught = p['catches']
    gear = [dict(GEAR_BY_ID[r['gear_key']], amount=r['amount']) for r in db.execute(
        'SELECT gear_key,amount FROM fishing_gear WHERE telegram_id=? AND amount>0', (uid,))
        if r['gear_key'] in GEAR_BY_ID]
    opened = {r['case_key']:r['opened'] for r in db.execute('SELECT case_key,opened FROM fishing_cases WHERE telegram_id=?', (uid,))}
    amounts={r['case_key']:r['amount'] for r in db.execute('SELECT case_key,amount FROM fishing_cases WHERE telegram_id=?',(uid,))}
    cases = [{**c,'amount':amounts.get(c['key'],0),'opened':opened.get(c['key'],0),'rewards':[{**GEAR_BY_ID[k],'chance':round(w/sum(c['weights'])*100,2)} for k,w in zip(c['items'],c['weights'])]} for c in CASES]
    player = dict(db.execute('SELECT p.*,b.avatar,b.blocked FROM players p JOIN bh b USING(telegram_id) WHERE telegram_id=?',(uid,)).fetchone())
    active = db.execute('SELECT payload FROM fishing_sessions WHERE telegram_id=? AND finished=0 AND expires>?',(uid,time.time())).fetchone()
    return {
        'best_kg':db.execute('SELECT COALESCE(MAX(kg),0) FROM fishing_catch_history WHERE telegram_id=?',(uid,)).fetchone()[0], 'player':player, 'level':level_info(p['xp']), 'active':json.loads(active[0]) if active else None, 'server_time':time.time(),
        'progress': {'xp':p['xp'], 'equipment':{k:p[k] for k in ['rod','tackle','reel','line','spoon','spinner']}, 'casts':p['casts'], 'catches':caught, 'last_cast':p['last_cast'],
                     'cooldown_seconds':COOLDOWN_SECONDS, 'rod':p['rod'], 'tackle':p['tackle']},
        'fish': inventory(db, 'fishing_fish', uid, FISH_BY_ID),
        'finds': inventory(db, 'fishing_finds', uid, FINDS_BY_ID),
        'discovered': [r[0] for r in db.execute('SELECT fish_key FROM fishing_discovered WHERE telegram_id=?', (uid,))],
        'gear': gear, 'cases':cases, 'locations':LOCATIONS,
        'catalog': {'fish':FISH, 'finds':FINDS, 'gear':GEAR, 'rarities':RARITIES},
    }


def choose_fish(location: str, rod_key: str, tackle_key: str):
    choice = [fish for fish in FISH if fish['location'] == location]
    luck = GEAR_BY_ID[rod_key]['luck'] + GEAR_BY_ID[tackle_key]['luck']
    weights = [f['weight'] * (1+luck*TIERS.index(f['rarity'])*.4) for f in choice]
    return RNG.choices(choice, weights=weights, k=1)[0]


def choose_find(luck: float):
    if RNG.random() >= min(.26, .09 + luck*.035):
        return None
    weights = dict(zip(TIERS,[58,25,18,10,5,1.7,.3]))
    # Better equipment modestly improves rare-find odds, without guaranteeing drops.
    choices = [f for f in FINDS]
    w = [weights[f['rarity']] * (1+luck if f['rarity'] in ('secret','exclusive') else 1) for f in choices]
    return RNG.choices(choices, weights=w, k=1)[0]


def add_item(db, table: str, uid: int, key: str):
    col = 'gear_key' if table == 'fishing_gear' else 'item_key'
    db.execute(f'''INSERT INTO {table} (telegram_id,{col},amount) VALUES (?,?,1)
                 ON CONFLICT(telegram_id,{col}) DO UPDATE SET amount=amount+1''', (uid,key))


@router.get('/state')
def fishing_state(user: dict=Depends(current_user)):
    with session(write=True) as db:
        ensure_fishing(db,user['id'])
        return snapshot(db,user['id'])


class Cast(BaseModel):
    location: str


@router.post('/cast')
def cast(data:Cast, user:dict=Depends(current_user)):
    if data.location not in LOC_BY_ID: raise HTTPException(400,'Нет локации')
    now=time.time(); uid=user['id']
    with session(write=True) as db:
        ensure_fishing(db,uid)
        row=db.execute('SELECT * FROM fishing_progress WHERE telegram_id=?',(uid,)).fetchone()
        if level_info(row['xp'])['level']<LOC_BY_ID[data.location]['level']: raise HTTPException(403,'Недостаточный уровень')
        active=db.execute('SELECT payload FROM fishing_sessions WHERE telegram_id=? AND finished=0 AND expires>?',(uid,now)).fetchone()
        if active: return {'battle':json.loads(active[0]),'state':snapshot(db,uid)}
        if now-row['last_cast']<COOLDOWN_SECONDS: raise HTTPException(429,f"Следующий заброс через {math.ceil(COOLDOWN_SECONDS-(now-row['last_cast']))} сек.")
        fish=choose_fish(data.location,row['rod'],row['tackle']); tier=TIERS.index(fish['rarity'])
        kg=round(RNG.uniform(.3,2.5)*(1+tier*.9),2)
        power=sum(GEAR_BY_ID.get(row[k],{}).get('luck',0) for k in ['rod','tackle','reel','line','spoon','spinner'])
        difficulty=min(1,tier/7+kg/35)
        battle=dict(id=uuid.uuid4().hex,fish=fish,kg=kg,duration=12+tier,started=now,expires=now+120,seed=RNG.random()*6.28,width=max(.12,.32-difficulty*.16+min(.09,power*.025)),speed=.7+difficulty*1.8,tier=tier)
        db.execute('INSERT OR REPLACE INTO fishing_sessions VALUES (?,?,?,?,0)',(uid,battle['id'],json.dumps(battle),now+120))
        db.execute('UPDATE fishing_progress SET casts=casts+1,last_cast=? WHERE telegram_id=?',(int(now),uid))
        return {'battle':battle,'state':snapshot(db,uid)}

class Tick(BaseModel):
    id:str
    position:float
    sequence:int

@router.post('/tick')
def tick(data:Tick,user:dict=Depends(current_user)):
    # Progress is integrated against server time, never accepted from the client.
    uid=user['id'];now=time.time()
    with session(write=True) as db:
        r=db.execute('SELECT * FROM fishing_sessions WHERE telegram_id=? AND session_id=?',(uid,data.id)).fetchone()
        if not r: raise HTTPException(404,'Заброс не найден')
        b=json.loads(r['payload'])
        if r['finished']: return {'done':True,'won':b.get('won',False),'score':b.get('score',0),'battle':b,'state':snapshot(db,uid)}
        if not math.isfinite(data.position) or not 0<=data.position<=1: raise HTTPException(400,'Некорректное положение')
        last=b.get('last',b['started']);dt=min(.45,max(0,now-last));t=now-b['started']
        target=max(.05,min(.95,.5+.30*math.sin(t*b['speed']+b['seed'])+.12*math.sin(t*b['speed']*(2.3 if b['tier']%2 else 1.7)+b['seed'])))
        if data.sequence>b.get('sequence',-1):
            inside=abs(data.position-target)<=b['width']/2
            b['score']=max(0,b.get('score',0)+dt*(1 if inside else -.55));b['last']=now;b['sequence']=data.sequence
        done=b.get('score',0)>=b['duration']*.56 or t>b['duration'] or now>r['expires']
        won=done and b.get('score',0)>=b['duration']*.56 and now<=r['expires'];b['won']=won
        if done and won:
            fish=b['fish'];add_item(db,'fishing_fish',uid,fish['key'])
            db.execute('INSERT INTO fishing_catch_history(telegram_id,fish_key,kg,ts) VALUES (?,?,?,?)',(uid,fish['key'],b['kg'],int(now)))
            db.execute('INSERT OR IGNORE INTO fishing_discovered VALUES (?,?)',(uid,fish['key']))
            xp=25+TIERS.index(fish['rarity'])*20+int(b['kg']*2)
            db.execute('UPDATE fishing_progress SET catches=catches+1,xp=xp+? WHERE telegram_id=?',(xp,uid));b['xp']=xp
            found=choose_find(0)
            if found: add_item(db,'fishing_finds',uid,found['key']);b['find']=found
        db.execute('UPDATE fishing_sessions SET payload=?,finished=? WHERE telegram_id=?',(json.dumps(b),int(done),uid))
        return dict(done=done,won=won,target=target,score=b.get('score',0),battle=b,state=snapshot(db,uid) if done else None)


class Equip(BaseModel):
    gear_key: str


@router.post('/equip')
def equip(data:Equip,user:dict=Depends(current_user)):
    gear = GEAR_BY_ID.get(data.gear_key)
    if not gear:
        raise HTTPException(400, 'Нет такого предмета')
    with session(write=True) as db:
        ensure_fishing(db,user['id'])
        owned = db.execute('SELECT amount FROM fishing_gear WHERE telegram_id=? AND gear_key=?',
                           (user['id'],data.gear_key)).fetchone()
        if not owned or owned['amount'] < 1:
            raise HTTPException(403, 'Этот предмет не найден в рюкзаке')
        db.execute(f'UPDATE fishing_progress SET {"tackle" if gear["type"]=="bait" else gear["type"]}=? WHERE telegram_id=?',
                   (data.gear_key,user['id']))
        return {'state':snapshot(db,user['id'])}


class CaseOpen(BaseModel):
    case_key: str


@router.post('/case/open')
def open_case(data:CaseOpen,user:dict=Depends(current_user)):
    case = CASE_BY_ID.get(data.case_key)
    if not case:
        raise HTTPException(400,'Нет такого кейса')
    with session(write=True) as db:
        uid = user['id']
        ensure_fishing(db,uid)
        balance=db.execute('SELECT coins FROM players WHERE telegram_id=?',(uid,)).fetchone()[0]
        owned=db.execute('SELECT amount FROM fishing_cases WHERE telegram_id=? AND case_key=?',(uid,data.case_key)).fetchone()
        if owned and owned[0]>0: db.execute('UPDATE fishing_cases SET amount=amount-1 WHERE telegram_id=? AND case_key=?',(uid,data.case_key))
        else:
            if balance<case['price']: raise HTTPException(409,'Недостаточно монет')
            db.execute('UPDATE players SET coins=coins-? WHERE telegram_id=?',(case['price'],uid))
        db.execute('UPDATE fishing_progress SET xp=xp+35 WHERE telegram_id=?',(uid,))
        gear_key=RNG.choices(case['items'],weights=case['weights'],k=1)[0]
        add_item(db,'fishing_gear',uid,gear_key)
        db.execute('''INSERT INTO fishing_cases (telegram_id,case_key,opened) VALUES (?,?,1)
                      ON CONFLICT(telegram_id,case_key) DO UPDATE SET opened=opened+1''',(uid,data.case_key))
        return {'reward':GEAR_BY_ID[gear_key], 'state':snapshot(db,uid)}


class SellFish(BaseModel):
    fish_key: str='all'


@router.post('/sell')
def sell_fish(data:SellFish,user:dict=Depends(current_user)):
    if data.fish_key != 'all' and data.fish_key not in FISH_BY_ID:
        raise HTTPException(400,'Неизвестная рыба')
    with session(write=True) as db:
        uid=user['id']
        rows=db.execute('SELECT item_key,amount FROM fishing_fish WHERE telegram_id=? AND amount>0', (uid,)).fetchall()
        selected=[r for r in rows if data.fish_key=='all' or r['item_key']==data.fish_key]
        reward=sum(FISH_BY_ID[r['item_key']]['value']*r['amount'] for r in selected)
        if not selected:
            raise HTTPException(409,'Нет рыбы для продажи')
        if data.fish_key=='all':
            db.execute('DELETE FROM fishing_fish WHERE telegram_id=?',(uid,))
        else:
            db.execute('DELETE FROM fishing_fish WHERE telegram_id=? AND item_key=?', (uid,data.fish_key))
        db.execute('UPDATE players SET coins=coins+? WHERE telegram_id=?',(reward,uid))
        return {'earned':reward, 'state':snapshot(db,uid), 'coins_added':reward}

@router.post('/buy')
def buy(data:Equip,user:dict=Depends(current_user)):
    g=GEAR_BY_ID.get(data.gear_key)
    if not g: raise HTTPException(404,'Нет предмета')
    with session(write=True) as db:
        uid=user['id'];ensure_fishing(db,uid)
        if db.execute('SELECT coins FROM players WHERE telegram_id=?',(uid,)).fetchone()[0]<g['price']: raise HTTPException(409,'Недостаточно монет')
        db.execute('UPDATE players SET coins=coins-? WHERE telegram_id=?',(g['price'],uid));add_item(db,'fishing_gear',uid,g['key'])
        return {'state':snapshot(db,uid)}
