"""Viva Fishing. Entirely virtual gameplay, with server-side inventory and free supply cases.

Cases never take coins, stars or payments: new openings are unlocked by caught fish.
All changes are inside SQLite IMMEDIATE transactions to prevent double-claiming.
"""
from __future__ import annotations

import random
import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import current_user
from config import ADMIN_ID
from db import session

router = APIRouter(prefix='/api/fishing', tags=['fishing'])
RNG = random.SystemRandom()
COOLDOWN_SECONDS = 4

RARITIES = {
    'common': 'Обычная', 'rare': 'Редкая', 'epic': 'Эпическая',
    'marine': 'Морская', 'secret': 'Секретная', 'exclusive': 'Эксклюзив',
}

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
    {'key':'starter_lure', 'type':'tackle', 'name':'Простой поплавок', 'rarity':'common', 'icon':'🪝', 'luck':0},
    {'key':'silver_hook', 'type':'tackle', 'name':'Серебряный крючок', 'rarity':'rare', 'icon':'🪝', 'luck':0.12},
    {'key':'flash_spinner', 'type':'tackle', 'name':'Мерцающая блесна', 'rarity':'epic', 'icon':'✨', 'luck':0.25},
    {'key':'coral_float', 'type':'tackle', 'name':'Коралловый поплавок', 'rarity':'marine', 'icon':'🪸', 'luck':0.4},
    {'key':'phantom_lure', 'type':'tackle', 'name':'Призрачная приманка', 'rarity':'secret', 'icon':'🔮', 'luck':0.6},
    {'key':'gold_hook', 'type':'tackle', 'name':'Золотой крючок', 'rarity':'exclusive', 'icon':'🏆', 'luck':0.9},
]

# 4 FREE cases; no currency, wager, purchases, or cash-out. Earn openings by fishing.
CASES = [
    {'key':'shore', 'name':'Береговой кейс', 'icon':'📦', 'every':3, 'subtitle':'Каждые 3 улова',
     'items':['river_rod','silver_hook','starter_rod','starter_lure'], 'weights':[25,35,20,20]},
    {'key':'lake', 'name':'Озёрный кейс', 'icon':'🎁', 'every':8, 'subtitle':'Каждые 8 уловов',
     'items':['carbon_rod','flash_spinner','river_rod','silver_hook'], 'weights':[20,20,30,30]},
    {'key':'marine', 'name':'Морской кейс', 'icon':'🧰', 'every':18, 'subtitle':'Каждые 18 уловов',
     'items':['sea_rod','coral_float','carbon_rod','flash_spinner'], 'weights':[25,25,25,25]},
    {'key':'secret', 'name':'Тайный кейс', 'icon':'🗝️', 'every':35, 'subtitle':'Каждые 35 уловов',
     'items':['gold_rod','gold_hook','shadow_rod','phantom_lure'], 'weights':[10,10,40,40]},
]

FISH_BY_ID = {r['key']: r for r in FISH}
FINDS_BY_ID = {r['key']: r for r in FINDS}
GEAR_BY_ID = {r['key']: r for r in GEAR}
LOC_BY_ID = {r['key']: r for r in LOCATIONS}
CASE_BY_ID = {r['key']: r for r in CASES}


def ensure_fishing(db, uid: int):
    """Create missing progress and free starter gear without touching existing balances."""
    db.execute('INSERT OR IGNORE INTO fishing_progress (telegram_id) VALUES (?)', (uid,))
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
    cases = [{**c, 'available':max(0,caught//c['every']-opened.get(c['key'],0)),
              'opened':opened.get(c['key'],0),
              'rewards': [{**GEAR_BY_ID[key], 'chance':weight} for key,weight in zip(c['items'],c['weights'])]}
             for c in CASES]
    return {
        'progress': {'casts':p['casts'], 'catches':caught, 'last_cast':p['last_cast'],
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
    tier_boost = {'common':1, 'rare':1+luck*.45, 'epic':1+luck*.85,
                  'marine':1+luck*1.25,'secret':1+luck*1.75}
    weights = [f['weight'] * tier_boost[f['rarity']] for f in choice]
    return RNG.choices(choice, weights=weights, k=1)[0]


def choose_find(luck: float):
    if RNG.random() >= min(.26, .09 + luck*.035):
        return None
    weights = {'common':58, 'rare':25, 'epic':10, 'marine':5, 'secret':1.7, 'exclusive':.3}
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
    if data.location not in LOC_BY_ID:
        raise HTTPException(400, 'Такой локации нет')
    now = int(time.time())
    with session(write=True) as db:
        uid = user['id']
        ensure_fishing(db,uid)
        row = db.execute('SELECT * FROM fishing_progress WHERE telegram_id=?', (uid,)).fetchone()
        if uid != ADMIN_ID and now - row['last_cast'] < COOLDOWN_SECONDS:
            raise HTTPException(429, f'Подожди {COOLDOWN_SECONDS - (now-row["last_cast"])} сек. до следующего заброса')
        rod, tackle = row['rod'], row['tackle']
        fish = choose_fish(data.location, rod, tackle)
        luck = GEAR_BY_ID[rod]['luck']+GEAR_BY_ID[tackle]['luck']
        found = choose_find(luck)
        add_item(db,'fishing_fish',uid,fish['key'])
        db.execute('INSERT OR IGNORE INTO fishing_discovered (telegram_id, fish_key) VALUES (?,?)', (uid,fish['key']))
        if found:
            add_item(db,'fishing_finds',uid,found['key'])
        db.execute('UPDATE fishing_progress SET casts=casts+1, catches=catches+1, last_cast=? WHERE telegram_id=?', (now,uid))
        return {'result': {'fish':fish,'find':found,'location':LOC_BY_ID[data.location]['name']},
                'state':snapshot(db,uid)}


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
        db.execute(f'UPDATE fishing_progress SET {"rod" if gear["type"]=="rod" else "tackle"}=? WHERE telegram_id=?',
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
        catches = db.execute('SELECT catches FROM fishing_progress WHERE telegram_id=?',(uid,)).fetchone()['catches']
        row = db.execute('SELECT opened FROM fishing_cases WHERE telegram_id=? AND case_key=?', (uid,data.case_key)).fetchone()
        opened = row['opened'] if row else 0
        if opened >= catches//case['every']:
            raise HTTPException(409,f'Кейс откроется после каждых {case["every"]} пойманных рыб')
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
