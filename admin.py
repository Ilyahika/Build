"""Fishing administration. All mutations are authorized and audited."""
import time
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from auth import admin_user
from db import session
from config import DB_PATH, STARTED
from system_state import maintenance_state,set_maintenance
from fishing import ensure_fishing,snapshot,GEAR_BY_ID,FISH_BY_ID,FINDS_BY_ID,CASE_BY_ID
router=APIRouter(prefix='/api/admin')
@router.get('/stats')
def stats(admin=Depends(admin_user)):
    with session() as db:
        counts={t:db.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0] for t in ['players','fishing_sessions']}
        return dict(**counts,catches=db.execute('SELECT COALESCE(SUM(catches),0) FROM fishing_progress').fetchone()[0],online=db.execute('SELECT COUNT(*) FROM bh WHERE last_seen>?',(time.time()-90,)).fetchone()[0],uptime=int(time.time()-STARTED),database=str(DB_PATH),integrity=db.execute('PRAGMA quick_check').fetchone()[0],maintenance=maintenance_state())
@router.get('/players')
def players(q:str='',page:int=0,admin=Depends(admin_user)):
    with session() as db:
        return [dict(r) for r in db.execute('SELECT p.telegram_id,p.telegram_name,p.nickname,p.coins,b.blocked,b.last_seen,COALESCE(f.xp,0) xp FROM players p JOIN bh b USING(telegram_id) LEFT JOIN fishing_progress f USING(telegram_id) WHERE CAST(p.telegram_id AS TEXT) LIKE ? OR PYLOWER(p.telegram_name) LIKE ? OR PYLOWER(p.nickname) LIKE ? ORDER BY b.last_seen DESC LIMIT 30 OFFSET ?',('%'+q+'%','%'+q.lower()+'%','%'+q.lower()+'%',max(0,page)*30))]
@router.get('/players/{uid}')
def player(uid:int,admin=Depends(admin_user)):
    with session(write=True) as db:
        if not db.execute('SELECT 1 FROM players WHERE telegram_id=?',(uid,)).fetchone():raise HTTPException(404,'Игрок не найден')
        ensure_fishing(db,uid);return snapshot(db,uid)
class Change(BaseModel):
    kind:str
    key:str=''
    delta:int=Field(default=0,ge=-1000000000,le=1000000000)
    reason:str=Field(default='',max_length=300)
@router.post('/players/{uid}')
def change(uid:int,data:Change,admin=Depends(admin_user)):
    with session(write=True) as db:
        if not db.execute('SELECT 1 FROM players WHERE telegram_id=?',(uid,)).fetchone():raise HTTPException(404,'Игрок не найден')
        ensure_fishing(db,uid)
        if data.kind in ['coins','xp']:
            table='players' if data.kind=='coins' else 'fishing_progress'
            db.execute(f'UPDATE {table} SET {data.kind}=MAX(0,{data.kind}+?) WHERE telegram_id=?',(data.delta,uid))
        elif data.kind=='block':db.execute('UPDATE bh SET blocked=?,reason=? WHERE telegram_id=?',(int(data.delta>0),data.reason,uid))
        elif data.kind=='cooldown':db.execute('UPDATE fishing_progress SET last_cast=0 WHERE telegram_id=?',(uid,))
        elif data.kind in ['gear','fish','find','case']:
            cat,table,col={'gear':(GEAR_BY_ID,'fishing_gear','gear_key'),'fish':(FISH_BY_ID,'fishing_fish','item_key'),'find':(FINDS_BY_ID,'fishing_finds','item_key'),'case':(CASE_BY_ID,'fishing_cases','case_key')}[data.kind]
            if data.key not in cat:raise HTTPException(400,'Неизвестный предмет')
            db.execute(f'INSERT INTO {table} (telegram_id,{col},amount) VALUES (?,?,?) ON CONFLICT(telegram_id,{col}) DO UPDATE SET amount=MAX(0,amount+?)',(uid,data.key,max(0,data.delta),data.delta))
            if data.kind=='gear':
                g=cat[data.key];slot='tackle' if g['type']=='bait' else g['type']
                amount=db.execute(f'SELECT amount FROM {table} WHERE telegram_id=? AND {col}=?',(uid,data.key)).fetchone()[0]
                if amount==0:
                    fallback='starter_rod' if slot=='rod' else 'starter_lure' if slot=='tackle' else ''
                    db.execute(f'UPDATE fishing_progress SET {slot}=? WHERE telegram_id=? AND {slot}=?',(fallback,uid,data.key))
        else:raise HTTPException(400,'Неизвестное действие')
        db.execute('INSERT INTO admin_log(ts,admin_id,target,action,value) VALUES (?,?,?,?,?)',(int(time.time()),admin['id'],uid,data.kind,f'{data.key}: {data.delta}; {data.reason}'))
        return snapshot(db,uid)
@router.get('/log')
def log(admin=Depends(admin_user)):
    with session() as db:return [dict(r) for r in db.execute('SELECT * FROM admin_log ORDER BY id DESC LIMIT 100')]
class Maintenance(BaseModel):
    enabled:bool
    message:str='Идёт обновление игры'
@router.post('/maintenance')
def maintenance(data:Maintenance,admin=Depends(admin_user)):
    return set_maintenance(data.enabled,data.message,admin['id'])
