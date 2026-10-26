import os,sys,time,tempfile
from pathlib import Path
from unittest.mock import patch
os.environ['DB_PATH']=tempfile.mktemp(suffix='.db');sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from main import app
from fastapi.testclient import TestClient
from auth import current_user,admin_user
from db import init_db,session
import community
init_db();uid=888;now=[time.time()]
app.dependency_overrides[current_user]=lambda:{'id':uid}
app.dependency_overrides[admin_user]=lambda:{'id':1181838335}
with session(write=True) as db:
 db.execute('INSERT INTO players(telegram_id,telegram_name,created_at) VALUES (?,?,?)',(uid,'Чат тест',int(now[0])))
 db.execute('INSERT INTO bh(telegram_id) VALUES (?)',(uid,))
c=TestClient(app)
def req(method,path,data=None):
 with patch.object(community.time,'time',return_value=now[0]):return c.request(method,path,json=data) if data is not None else c.request(method,path)
assert req('GET','/api/fishing/state').json()['progress']['cooldown_seconds']==60
for kind in ['hourly','daily']:
 r=req('POST','/api/community/rewards/claim',{'kind':kind});assert r.status_code==200,r.text
 before=r.json()['state']['player']['coins']
 assert req('POST','/api/community/rewards/claim',{'kind':kind}).status_code==429
 assert req('GET','/api/fishing/state').json()['player']['coins']==before
assert req('POST','/api/community/chat',{'text':'Привет, рыбаки!'}).status_code==200
assert req('POST','/api/community/chat',{'text':'Спам'}).status_code==429
r=req('GET','/api/community/chat');assert r.json()['messages'][0]['text']=='Привет, рыбаки!'
mid=r.json()['messages'][0]['id']
assert req('POST','/api/community/chat/delete',{'id':mid}).status_code==200
assert req('GET','/api/community/chat').json()['messages'][0]['deleted']==1
now[0]+=6
assert req('POST','/api/community/chat',{'text':'<script>alert(1)</script>'}).status_code==200
# Consume exactly five real casts; successful/failed/abandoned result does not refund attempts.
for i in range(5):
 r=req('POST','/api/fishing/cast',{'location':'pond'});assert r.status_code==200,r.text
 assert r.json()['state']['attempts']['remaining']==4-i
 # Resume must not consume again.
 assert req('POST','/api/fishing/cast',{'location':'pond'}).json()['state']['attempts']['remaining']==4-i
 with session(write=True) as db:db.execute('UPDATE fishing_sessions SET finished=1 WHERE telegram_id=?',(uid,))
 assert req('POST','/api/fishing/cast',{'location':'pond'}).status_code==429
 now[0]+=60
assert req('POST','/api/fishing/cast',{'location':'pond'}).status_code==429
before=req('GET','/api/fishing/state').json();init_db();after=req('GET','/api/fishing/state').json()
assert before['attempts']==after['attempts'] and before['rewards']==after['rewards']
now[0]+=3600
assert req('POST','/api/fishing/cast',{'location':'pond'}).status_code==200
assert req('POST','/api/community/rewards/claim',{'kind':'hourly'}).status_code==200
now[0]+=86400
assert req('POST','/api/community/rewards/claim',{'kind':'daily'}).json()['rewards']['streak']==2
assert req('GET','/assets/fish_atlas.png').status_code==200
assert req('GET','/assets/lure_atlas.png').status_code==200
assert req('GET','/assets/config.py').status_code==404
app.dependency_overrides.pop(admin_user)
assert req('POST','/api/community/chat/delete',{'id':mid}).status_code==403
print('PASS: 60s cooldown, 5 hourly attempts and resume, atomic hourly/daily rewards, streak, chat persistence/slow mode/moderation, image assets and authorization')
