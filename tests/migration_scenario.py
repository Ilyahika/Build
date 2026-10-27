"""V10 -> V11 migration, admin inventory changes and concurrent claims."""
import os,sys,tempfile,time,json,subprocess
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
os.environ['DB_PATH']=tempfile.mktemp(suffix='.db');os.environ['BOT_TOKEN']=''
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from main import app
from db import init_db,session
from auth import current_user,admin_user
from fastapi.testclient import TestClient
from config import ADMIN_ID
from fishing import ensure_fishing
init_db();uid=555
with session(write=True) as db:
 db.execute('INSERT INTO players(telegram_id,telegram_name,coins,created_at) VALUES (?,?,?,?)',(uid,'V10 игрок',12345,int(time.time())))
 db.execute('INSERT INTO bh(telegram_id) VALUES (?)',(uid,))
 db.execute('INSERT INTO fishing_progress(telegram_id,xp,casts,catches) VALUES (?,?,?,?)',(uid,1200,30,20))
 db.execute('INSERT INTO fishing_fish VALUES (?,?,?)',(uid,'crucian',2))
 db.execute('INSERT INTO fishing_catch_history(telegram_id,fish_key,kg,ts) VALUES (?,?,?,?)',(uid,'crucian',1.234,int(time.time())))
 db.execute('INSERT INTO fishing_gear VALUES (?,?,?)',(uid,'starter_rod',1))
 db.execute('INSERT INTO fishing_gear VALUES (?,?,?)',(uid,'starter_lure',10))
 db.execute('INSERT INTO fishing_gear VALUES (?,?,?)',(uid,'line_common',10))
 db.execute('INSERT INTO fishing_cases(telegram_id,case_key,opened,amount) VALUES (?,?,?,?)',(uid,'lake',7,3))
app.dependency_overrides[current_user]=lambda:{'id':uid}
app.dependency_overrides[admin_user]=lambda:{'id':ADMIN_ID}
c=TestClient(app)
def get():
 r=c.get('/api/fishing/state');assert r.status_code==200,r.text;return r.json()
s=get();assert s['player']['coins']==12345 and s['progress']['xp']==1200
assert sorted(f['kg'] for f in s['catches'])==[.05,1.234]
assert all(g['type'] in ('rod','reel','bait') for g in s['gear'])
case=next(x for x in s['cases'] if x['key']=='reel_0');assert (case['amount'],case['opened'])==(3,7)
for _ in range(3):init_db();assert get()['gear']==s['gear'] and get()['catches']==s['catches']
for kind,key in [('fish','crucian'),('gear','starter_rod'),('case','shore')]:
 for delta in (2,-1):
  r=c.post('/api/admin/players/'+str(uid),json=dict(kind=kind,key=key,delta=delta));assert r.status_code==200,r.text
assert len(get()['catches'])==3
for path in ['/api/admin/stats?deep=true','/api/admin/players','/api/admin/live','/api/admin/log','/api/admin/cases','/api/admin/player?id='+str(uid)]:
 r=c.get(path);assert r.status_code==200,(path,r.text)
assert c.post('/api/admin/cases/shore',json=dict(price=800,weights={'reel_common':1})).status_code==400
assert c.post('/api/admin/cases/shore',json=dict(price=800,weights={'starter_rod':1})).status_code==200
# Free cases are consumed before paid cases.
free_before=get()['player']['coins']
r=c.post('/api/fishing/case/open',json=dict(case_key='reel_0',count=3));assert r.status_code==200,r.text
assert r.json()['state']['player']['coins']==free_before
# Concurrent promo activation is atomic.
r=c.post('/api/v11/admin/promo',json=dict(code='CONCURRENT',coins=1000,xp=1,uses=1));assert r.status_code==200,r.text
before=get()['player']['coins']
def claim(_):return TestClient(app).post('/api/v11/promo',json=dict(code='CONCURRENT')).status_code
with ThreadPoolExecutor(max_workers=4) as pool:statuses=list(pool.map(claim,range(4)))
assert statuses.count(200)==1 and statuses.count(409)==3,statuses
assert get()['player']['coins']==before+1000
# Restart process sees original identity, individual catches, balances and profile.
before=get();code="import sys,json;sys.path.insert(0,sys.argv[1]);from db import init_db;init_db();from fishing import fishing_state;print(json.dumps(fishing_state({'id':555})))"
r=subprocess.run([sys.executable,'-c',code,str(Path(__file__).resolve().parents[1])],capture_output=True,text=True)
assert r.returncode==0,r.stderr
reload=json.loads(r.stdout)
for key in ['player','progress','gear','catches','profile']:assert before[key]==reload[key],key
print('PASS: V10 migration; stack weight reconstruction; case conversion; one-time starter reel; admin grants/removals/settings/stats; concurrent promo activation; process restart persistence.')
