"""Isolated API integration checks; never uses the production database or bot."""
import os,sys,tempfile,time,json,threading
from pathlib import Path
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
os.environ['DB_PATH']=tempfile.mktemp(suffix='.db');os.environ['BOT_TOKEN']=''
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from main import app
from db import init_db,session
from auth import current_user,admin_user
from config import ADMIN_ID
from fastapi.testclient import TestClient
from fishing import GEAR,FISH,CASES,TIERS
init_db();uid=987
app.dependency_overrides[current_user]=lambda:{'id':uid}
app.dependency_overrides[admin_user]=lambda:{'id':ADMIN_ID}
c=TestClient(app)
with session(write=True) as db:
 for x in [uid,ADMIN_ID,988]:
  db.execute('INSERT INTO players(telegram_id,telegram_name,coins,created_at) VALUES (?,?,?,?)',(x,'Рыбак '+str(x),1000000,int(time.time())))
  db.execute('INSERT INTO bh(telegram_id) VALUES (?)',(x,))
def get(path):
 r=c.get(path);assert r.status_code==200,r.text;return r.json()
def post(path,data,status=200):
 r=c.post(path,json=data);assert r.status_code==status,(path,r.status_code,r.text);return r.json()
s=get('/api/fishing/state');assert sum(g['amount'] for g in s['gear'])==3
assert len(s['catalog']['fish'])==120 and set(g['type'] for g in GEAR)=={'rod','reel','bait'}
assert all(0<=g['luck']<=.15 for g in GEAR)
for i in range(6):assert max(g['price'] for g in GEAR if g['rarity']==TIERS[i])<min(g['price'] for g in GEAR if g['rarity']==TIERS[i+1])
for case in CASES:assert len({next(g['type'] for g in GEAR if g['key']==k) for k in case['items']})==1
now=time.time()
with patch('time.time',return_value=now):
 for i in range(5):
  r=post('/api/fishing/cast',{'location':'pond'});b=r['battle'];assert r['state']['attempts']['remaining']==4-i
  # Resume cannot spend twice; early tick cannot deliver a reward.
  assert post('/api/fishing/cast',{'location':'pond'})['battle']['id']==b['id']
  tick={'id':b['id'],'position':.5,'sequence':1}
  assert not post('/api/fishing/tick',tick)['done']
  with patch('time.time',return_value=now+11):
   r=post('/api/fishing/tick',tick);assert r['done'] and r['won'];assert r['state']['progress']['catches']==i+1
   assert post('/api/fishing/tick',tick)['state']['progress']['catches']==i+1
 post('/api/fishing/cast',{'location':'pond'},429)
 with patch('time.time',return_value=now+119):assert get('/api/fishing/state')['attempts']['remaining']==0
 with patch('time.time',return_value=now+120):assert get('/api/fishing/state')['attempts']['remaining']==1
 with patch('time.time',return_value=now+600):assert get('/api/fishing/state')['attempts']['remaining']==5
# equipment gate even at sufficient level
with session(write=True) as db:db.execute('UPDATE fishing_progress SET xp=100000 WHERE telegram_id=?',(uid,))
post('/api/fishing/cast',{'location':'ocean'},409)
s=get('/api/fishing/state');f=s['catches'][0]
post('/api/v11/tank',{'action':'add','id':f['id']})
with session() as db:anchor=db.execute('SELECT anchor FROM tanks_v11 WHERE telegram_id=?',(uid,)).fetchone()[0]
with patch('time.time',return_value=anchor+3600):
 s=get('/api/fishing/state');rate=s['aquarium']['rate'];assert abs(s['aquarium']['balance']-rate)<.02
 post('/api/v11/tank',{'action':'remove','id':f['id']})
 # moving fish neither duplicates money nor resets deadline
 assert get('/api/fishing/state')['aquarium']['cap_at']==s['aquarium']['cap_at']
 post('/api/v11/tank',{'action':'add','id':f['id']})
with patch('time.time',return_value=anchor+30000):
 s=get('/api/fishing/state');assert abs(s['aquarium']['balance']-5*rate)<.02
 before=s['player']['coins'];r=post('/api/v11/tank',{'action':'claim'});assert r['state']['player']['coins']==before+int(s['aquarium']['balance'])
 r=post('/api/v11/tank',{'action':'claim'});assert r['state']['player']['coins']==before+int(s['aquarium']['balance'])
# fixed actual-weight sales, owner-scoped IDs
s=get('/api/fishing/state');f=s['catches'][0];before=s['player']['coins'];r=post('/api/fishing/sell',{'fish_key':str(f['id'])});assert r['earned']==f['value'];post('/api/fishing/sell',{'fish_key':str(f['id'])},409)
for count in [1,3,5,10]:
 s=get('/api/fishing/state');case=s['cases'][0];r=post('/api/fishing/case/open',{'case_key':case['key'],'revision':case['revision'],'count':count});assert len(r['rewards'])==count
 assert sum(g['amount'] for g in r['state']['gear'])<=20
 for x in r['rewards']:assert x['reward']['sell_price']==x['reward']['price']//2
# bank and inventory rollback when insufficient money
with session(write=True) as db:db.execute('UPDATE players SET coins=0 WHERE telegram_id=?',(uid,))
post('/api/fishing/case/open',{'case_key':'shore','count':10},409)
post('/api/v11/admin/promo',{'code':'VIVA_TEST','coins':500,'xp':50,'uses':2})
post('/api/v11/promo',{'code':'viva_test'});post('/api/v11/promo',{'code':'VIVA_TEST'},409)
post('/api/v11/admin/staff',{'uid':uid,'moderator':True,'prefix':'🫆 Модератор'})
assert len(get('/api/v11/players')['players'])==3
get('/api/v11/players/988');post('/api/v11/players/988/block',{'blocked':True,'reason':'Проверка'})
# full admin endpoints stay unavailable to moderator
app.dependency_overrides.pop(admin_user)
post('/api/v11/admin/staff',{'uid':uid,'moderator':True},403)
post('/api/admin/players/988',{'kind':'coins','delta':100},403)
post('/api/v11/players/'+str(ADMIN_ID)+'/block',{'blocked':True},403)
for kind in ['level','coins','record']:get('/api/v11/top?kind='+kind)
# public/static boundaries and existing admin pages
for path in ['/','/v11.js','/style.css','/assets/fish_atlas.png']:get_r=c.get(path);assert get_r.status_code==200,path
assert c.get('/features_v11.py').status_code==404
print('PASS V11: 120 species; rarity economy; equipment gate; 5/120s allowance; server catch timing/resume/idempotency; aquarium income/move/cap/claim; individual sales; 1/3/5/10 cases; capacity; promo single use; moderator privilege boundaries; top; static files.')
