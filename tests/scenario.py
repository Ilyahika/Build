"""Integration tests use an isolated SQLite file and a controlled clock."""
from pathlib import Path
import os,sys,tempfile,time,json,sqlite3,math
from unittest.mock import patch
os.environ['DB_PATH']=tempfile.mktemp(suffix='.db')
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from main import app
from auth import current_user,admin_user
from db import init_db,session
import fishing
from fishing_engine import target_at,loadout
uid=777;clock=[time.time()]
app.dependency_overrides[current_user]=lambda:{'id':uid}
app.dependency_overrides[admin_user]=lambda:{'id':1181838335}
with sqlite3.connect(os.environ['DB_PATH']) as old:
 old.execute("CREATE TABLE fishing_progress(telegram_id INTEGER PRIMARY KEY,casts INTEGER NOT NULL DEFAULT 0,catches INTEGER NOT NULL DEFAULT 0,last_cast INTEGER NOT NULL DEFAULT 0,rod TEXT NOT NULL DEFAULT 'starter_rod',tackle TEXT NOT NULL DEFAULT 'starter_lure')")
 old.execute('INSERT INTO fishing_progress(telegram_id,casts,catches) VALUES (778,20,12)')
 old.execute('CREATE TABLE fishing_cases(telegram_id INTEGER NOT NULL,case_key TEXT NOT NULL,opened INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(telegram_id,case_key))')
 old.execute("INSERT INTO fishing_cases VALUES (778,'shore',4)")
init_db()
with session(write=True) as db:
 assert tuple(db.execute('SELECT catches,xp FROM fishing_progress WHERE telegram_id=778').fetchone())==(12,0)
 assert tuple(db.execute("SELECT opened,amount FROM fishing_cases WHERE telegram_id=778").fetchone())==(4,0)
 db.execute('INSERT INTO players(telegram_id,telegram_name,created_at,coins) VALUES (?,?,?,100000)',(uid,'Тест',int(clock[0])))
 db.execute('INSERT INTO bh(telegram_id) VALUES (?)',(uid,))
c=TestClient(app)
def req(method,url,body=None,delta=0):
 clock[0]+=delta
 with patch.object(fishing.time,'time',return_value=clock[0]):
  return c.request(method,url,json=body) if body is not None else c.request(method,url)
def ok(method,url,body=None,delta=0):
 r=req(method,url,body,delta);assert r.status_code==200,(url,r.status_code,r.text[:600]);return r.json()
def state():return ok('GET','/api/fishing/state')
def clear_timer():
 with session(write=True) as db:db.execute('UPDATE fishing_progress SET last_cast=0 WHERE telegram_id=?',(uid,))
def drive(b,win=True):
 pulling=True
 for i in range(700):
  if b.get('done'):return b
  if b['tension']>.65:pulling=False
  if b['tension']<.35:pulling=True
  position=target_at(b,b.get('fight_time',0)+.25)
  r=ok('POST','/api/fishing/tick',dict(id=b['id'],sequence=b.get('sequence',-1)+1,position=position,reeling=pulling if win else False,hook=b['phase']=='bite'),.25)
  b=r['battle']
  if r['done']:return b
 raise AssertionError('Battle did not settle')
s=state();assert len(s['catalog']['fish'])==120 and len(s['catalog']['gear'])==125
assert len(s['catalog']['rarities'])==7
assert all(g['stats'] and g['effect'] for g in s['catalog']['gear'])
assert all(abs(sum(f['chance'] for f in pool)-100)<1e-8 for pool in s['fish_odds'].values())
assert all(abs(sum(g['chance'] for g in case['rewards'])-100)<1e-8 for case in s['cases'])
# Every slot has a distinct, effective role, and upgrades improve that role.
for typ,metric in [('rod','control'),('reel','retrieve'),('line','strength'),('bait','attraction'),('spoon','fatigue'),('spinner','hook_window')]:
 low=loadout({'slot':f'v5_{typ}_common_0'},fishing.GEAR_BY_ID)
 high=loadout({'slot':f'v5_{typ}_absolute_0'},fishing.GEAR_BY_ID)
 assert high[metric]>low[metric]>0
assert req('POST','/api/fishing/buy',{'gear_key':'river_rod'}).status_code==403
assert req('POST','/api/fishing/cast',{'location':'lake'}).status_code==403
assert req('POST','/api/fishing/profile',{'nickname':'a','avatar':'🎣'}).status_code==422
assert req('POST','/api/fishing/profile',{'nickname':'Игрок','avatar':'invalid'}).status_code==400
s=ok('POST','/api/fishing/profile',{'nickname':'Илья Рыбак','avatar':'🦈'})['state'];assert s['player']['nickname']=='Илья Рыбак' and s['player']['avatar']=='🦈'
# Fish, profile and all progress survive reopening, including an unfinished cast.
b=ok('POST','/api/fishing/cast',{'location':'pond'})['battle']
assert ok('POST','/api/fishing/cast',{'location':'pond'})['battle']['id']==b['id']
b=ok('POST','/api/fishing/tick',dict(id=b['id'],sequence=0,position=.5),.25)['battle']
init_db();clock[0]+=86400*2
r=ok('POST','/api/fishing/tick',dict(id=b['id'],sequence=1,position=.5));assert r['battle']['phase_time']==b['phase_time'] and not r['done']
b=drive(r['battle']);assert b['won']
s=state();assert s['progress']['catches']==1 and s['level']['xp']>0
r=ok('POST','/api/fishing/tick',dict(id=b['id'],sequence=9999,position=.5));assert r['state']['progress']['catches']==1
ok('POST','/api/fishing/sell',{'fish_key':'all'})
# Deliberately fail and replay: exactly one captured line and bait are lost.
clear_timer();before=state();amounts={g['key']:g['amount'] for g in before['gear']}
b=ok('POST','/api/fishing/cast',{'location':'pond'})['battle'];b=drive(b,False);assert not b['won'] and len(b['lost'])==2
s=state();after={g['key']:g['amount'] for g in s['gear']}
for key in ['line_common','starter_lure']:assert after[key]==amounts[key]-1
ok('POST','/api/fishing/tick',dict(id=b['id'],sequence=10000,position=.5));assert state()['gear']==s['gear']
assert state()['progress']['cooldown_seconds']==0
# Deterministic case pools exercise the same weighted selection as production.
key='v5_rod_absolute_1'
ok('POST','/api/admin/cases/shore',{'price':100,'enabled':True,'weights':{key:1}})
with session(write=True) as db:db.execute('UPDATE players SET coins=1000 WHERE telegram_id=?',(uid,))
r=ok('POST','/api/fishing/case/open',{'case_key':'shore'});assert not r['duplicate'] and r['quantity']==1 and r['state']['player']['coins']==900
r=ok('POST','/api/fishing/case/open',{'case_key':'shore'});assert r['duplicate'] and r['compensation']==90 and r['state']['player']['coins']==890
assert next(g for g in r['state']['gear'] if g['key']==key)['amount']==1
key='v5_line_mythic_0';ok('POST','/api/admin/cases/shore',{'price':100,'enabled':True,'weights':{key:1}})
r=ok('POST','/api/fishing/case/open',{'case_key':'shore'});assert r['quantity']==3 and not r['duplicate']
r=ok('POST','/api/fishing/case/open',{'case_key':'shore'});assert r['duplicate'] and r['compensation']==65
assert next(g for g in r['state']['gear'] if g['key']==key)['amount']==3
# Clover multiplies target weights, and the displayed probabilities use those weights.
ok('POST','/api/admin/cases/shore',{'price':100,'enabled':True,'weights':{'starter_rod':1,'v5_rod_absolute_1':1}})
base=state();old_case=base['cases'][0]
assert [g['chance'] for g in old_case['rewards']]==[50,50]
for factor in [2,3,5]:
 grant=ok('POST',f'/api/admin/players/{uid}/luck',{'multiplier':factor,'minutes':1});s=state()
 assert s['buff']['multiplier']==factor
 assert abs(s['cases'][0]['rewards'][1]['chance']-factor/(factor+1)*100)<1e-9
 assert req('POST','/api/fishing/case/open',{'case_key':'shore','revision':old_case['revision']}).status_code==409
init_db();assert state()['buff']['multiplier']==5
clock[0]+=61;assert state()['buff']['multiplier']==1
assert req('POST',f'/api/admin/players/{uid}/luck',{'multiplier':10,'minutes':1}).status_code==422
assert req('POST','/api/admin/cases/shore',{'price':100,'enabled':True,'weights':{}}).status_code==400
ok('POST','/api/admin/cases/shore',{'price':100,'enabled':False,'weights':{'starter_rod':1}})
assert req('POST','/api/fishing/case/open',{'case_key':'shore'}).status_code==409
# Ordinary gear, timers, balances and inventory are stable across startup migrations.
before=state();init_db();after=state()
for key in ['player','progress','level','gear','fish','finds','cases','buff']:assert before[key]==after[key],key
for url in ['/api/admin/stats?deep=true','/api/admin/players?q=Илья&sort=xp','/api/admin/live','/api/admin/maintenance','/api/admin/broadcast','/api/admin/log',f'/api/admin/player?id={uid}']:
 ok('GET',url)
ok('POST','/api/admin/act',{'telegram_id':uid,'act':'xp_set','value':'500'});assert state()['level']['xp']==500
for kind,item in [('gear','line_rare'),('fish','crucian'),('find','shell'),('case','shore')]:
 ok('POST',f'/api/admin/players/{uid}',{'kind':kind,'key':item,'delta':2})
 ok('POST',f'/api/admin/players/{uid}',{'kind':kind,'key':item,'delta':-1})
# A stronger line changes the outcome under the same load, not just its label.
from fishing_engine import create_battle,advance
from copy import deepcopy
fish=fishing.FISH_BY_ID['crucian'];base_equipment={'rod':'starter_rod','line':'line_common','tackle':'starter_lure'}
weak=create_battle(fish,30,base_equipment,loadout(base_equipment,fishing.GEAR_BY_ID),0,'weak',0,0);weak['phase']='fight'
strong=deepcopy(weak);strong['stats']=loadout({**base_equipment,'line':'v5_line_absolute_1'},fishing.GEAR_BY_ID)
for i in range(1,41):
 for simulation in [weak,strong]:
  if not simulation['done']:advance(simulation,i*.25,target_at(simulation,simulation['fight_time']+.25),True,False,i)
assert weak['done'] and not weak['won'] and not strong['done']
# Slow human reaction misses a basic hook window but succeeds with an upgraded spinner.
slow=create_battle(fish,1,base_equipment,loadout(base_equipment,fishing.GEAR_BY_ID),0,'slow',0,0);slow['phase']='bite'
fast=deepcopy(slow);fast['hook_window']+=fishing.GEAR_BY_ID['v5_spinner_absolute_0']['stats']['hook_window']
for i in range(1,7):
 for simulation in [slow,fast]:
  if not simulation['done']:advance(simulation,i*.25,.5,False,i==6,i)
assert slow['done'] and fast['phase']=='fight' and not fast['done']
# A completely new Python process must see the stored profile, balances and inventory.
import subprocess
expected=state();code="import sys,json;sys.path.insert(0,sys.argv[1]);from db import init_db;init_db();from fishing import fishing_state;print(json.dumps(fishing_state({'id':777})))"
process=subprocess.run([sys.executable,'-c',code,str(Path(__file__).resolve().parents[1])],capture_output=True,text=True,env=os.environ.copy())
assert process.returncode==0,process.stderr
reloaded=json.loads(process.stdout)
for key in ['player','progress','level','gear','fish','finds']:assert expected[key]==reloaded[key],key

app.dependency_overrides.pop(admin_user)
assert req('GET','/api/admin/stats').status_code==403
assert req('POST',f'/api/admin/players/{uid}/luck',{'multiplier':5,'minutes':1}).status_code==403
# Optional fixtures for local browser QA. No production data or token is exported.
if os.getenv('VIVA_QA_FIXTURES'):
 app.dependency_overrides[admin_user]=lambda:{'id':1181838335}
 ok('POST','/api/admin/cases/shore',{'price':300,'enabled':True,'weights':{'starter_rod':7,'v5_rod_absolute_1':1}})
 ok('POST',f'/api/admin/players/{uid}/luck',{'multiplier':3,'minutes':30})
 fixtures={url:ok('GET',url) for url in ['/api/fishing/state','/api/fishing/luck','/api/admin/stats','/api/admin/players','/api/admin/live','/api/admin/maintenance','/api/admin/broadcast','/api/admin/log','/api/admin/cases',f'/api/admin/player?id={uid}']}
 clear_timer();fixtures['/api/fishing/state']=state();fixtures['battle']=ok('POST','/api/fishing/cast',{'location':'pond'})['battle']
 Path(tempfile.gettempdir(),'viva5_fixtures.json').write_text(json.dumps(fixtures))
print('PASS: 120 fish, 125 functional gear, phases, win/loss, single consumption, replay protection, profile, drop odds, clover x2/x3/x5 and expiry, duplicate compensation, persistence, full admin and authorization')
