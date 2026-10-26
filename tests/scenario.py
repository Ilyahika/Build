from pathlib import Path
import os,sys,tempfile,time,math,json
os.environ['DB_PATH']=tempfile.mktemp(suffix='.db');sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from main import app
from auth import current_user,admin_user
from db import init_db,session
import fishing,admin
uid=777
app.dependency_overrides[current_user]=lambda:{'id':uid}
app.dependency_overrides[admin_user]=lambda:{'id':1181838335}
# Migration from the uploaded version's tables must preserve existing counters.
import sqlite3
with sqlite3.connect(os.environ['DB_PATH']) as old:
 old.execute("CREATE TABLE fishing_progress (telegram_id INTEGER PRIMARY KEY, casts INTEGER NOT NULL DEFAULT 0, catches INTEGER NOT NULL DEFAULT 0,last_cast INTEGER NOT NULL DEFAULT 0,rod TEXT NOT NULL DEFAULT 'starter_rod',tackle TEXT NOT NULL DEFAULT 'starter_lure')")
 old.execute("INSERT INTO fishing_progress(telegram_id,casts,catches) VALUES (778,20,12)")
 old.execute("CREATE TABLE fishing_cases(telegram_id INTEGER NOT NULL,case_key TEXT NOT NULL,opened INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(telegram_id,case_key))")
 old.execute("INSERT INTO fishing_cases VALUES (778,'shore',4)")
init_db()
with session() as migrated:
 assert migrated.execute('SELECT catches,xp FROM fishing_progress WHERE telegram_id=778').fetchone()[:]==(12,0)
 assert migrated.execute('SELECT opened,amount FROM fishing_cases WHERE telegram_id=778').fetchone()[:]==(4,0)
with session(write=True) as db:
 db.execute('INSERT INTO players(telegram_id,telegram_name,created_at,coins) VALUES (?,?,?,?)',(uid,'Тест',int(time.time()),100000))
 db.execute('INSERT INTO bh(telegram_id) VALUES (?)',(uid,))
c=TestClient(app)
s=c.get('/api/fishing/state');assert s.status_code==200,s.text
assert len(s.json()['catalog']['rarities'])==7
assert c.post('/api/fishing/cast',json={'location':'lake'}).status_code==403
s=c.post('/api/fishing/cast',json={'location':'pond'}).json();b=s['battle']
assert c.post('/api/fishing/cast',json={'location':'pond'}).json()['battle']['id']==b['id']
# Drive the real scoring algorithm using a controlled server clock.
clock=b['started']; seq=0
from unittest.mock import patch
for i in range(1,100):
 clock=b['started']+i*.25;t=clock-b['started'];target=max(.05,min(.95,.5+.30*math.sin(t*b['speed']+b['seed'])+.12*math.sin(t*b['speed']*(2.3 if b['tier']%2 else 1.7)+b['seed'])))
 with patch.object(fishing.time,'time',return_value=clock):r=c.post('/api/fishing/tick',json={'id':b['id'],'position':target,'sequence':i})
 assert r.status_code==200,r.text
 if r.json()['done']:break
assert r.json()['won'];assert r.json()['state']['progress']['catches']==1
assert r.json()['state']['level']['xp']>0
# Repeated settlement cannot duplicate fish or XP.
r2=c.post('/api/fishing/tick',json={'id':b['id'],'position':.5,'sequence':200});assert r2.json()['state']['progress']['catches']==1
assert c.post('/api/fishing/cast',json={'location':'pond'}).status_code==429
assert c.post('/api/fishing/buy',json={'gear_key':'reel_rare'}).status_code==200
assert c.post('/api/fishing/equip',json={'gear_key':'reel_rare'}).json()['state']['progress']['equipment']['reel']=='reel_rare'
assert c.post('/api/fishing/case/open',json={'case_key':'shore'}).status_code==200
assert c.post('/api/fishing/sell',json={'fish_key':'all'}).status_code==200
for kind,key in [('xp',''),('coins',''),('gear','line_rare'),('fish','crucian'),('find','shell'),('case','shore')]:
 r=c.post(f'/api/admin/players/{uid}',json={'kind':kind,'key':key,'delta':3});assert r.status_code==200,r.text
r=c.post(f'/api/admin/players/{uid}',json={'kind':'case','key':'shore','delta':-1});assert r.status_code==200
before=c.get('/api/fishing/state').json();init_db();after=c.get('/api/fishing/state').json()
for k in ['player','progress','level','fish','gear','cases']:assert before[k]==after[k],k
# Insufficient funds must roll back inventory and XP.
with session(write=True) as db:db.execute('UPDATE players SET coins=0 WHERE telegram_id=?',(uid,))
assert c.post('/api/fishing/buy',json={'gear_key':'reel_absolute'}).status_code==409
assert c.get('/api/admin/stats').status_code==200
assert c.get('/api/admin/log').status_code==200
assert c.post('/api/bh/tap',json={}).status_code==404
print('PASS: levels, session resume, catch verification, replay protection, cooldown, purchases, equipment, cases, sales, admin inventory and XP, restart persistence, insufficient funds, legacy routes disabled')

app.dependency_overrides.pop(admin_user)
assert c.get('/api/admin/stats').status_code==403
assert c.post(f'/api/admin/players/{uid}',json={'kind':'coins','delta':100}).status_code==403

# Failure and expired sessions never award fish.
with session(write=True) as db:db.execute('UPDATE fishing_progress SET last_cast=0 WHERE telegram_id=?',(uid,))
b=c.post('/api/fishing/cast',json={'location':'pond'}).json()['battle']
with patch.object(fishing.time,'time',return_value=b['expires']+1):
 r=c.post('/api/fishing/tick',json={'id':b['id'],'position':.5,'sequence':1})
 assert r.status_code==200 and r.json()['done'] and not r.json()['won']
