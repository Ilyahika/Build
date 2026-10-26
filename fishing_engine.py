"""Deterministic fishing simulation; clients submit controls, never rewards."""
import math

def loadout(equipment,catalog):
    stats={}
    for key in equipment.values():
        for name,value in catalog.get(key,{}).get('stats',{}).items():stats[name]=stats.get(name,0)+value
    return stats

def target_at(b,t=None):
    t=b.get('fight_time',0) if t is None else t
    speed=b['speed']*(.65 if b.get('stamina',100)<20 else 1)
    behavior=b['fish'].get('behavior','calm');seed=b['seed']
    if behavior=='dart':x=.5+.28*math.sin(t*speed+seed)+.15*math.sin(t*speed*3.7+seed)
    elif behavior=='bottom':x=.65+.2*math.sin(t*speed*.7+seed)
    elif behavior=='school':x=.5+.30*math.sin(t*speed*.8+seed)
    elif behavior=='predator':x=.5+.25*math.sin(t*speed+seed)+.15*math.sin(t*speed*2.2)
    else:x=.5+.27*math.sin(t*speed*.65+seed)
    return max(.06,min(.94,x))

def create_battle(fish,kg,equipment,stats,seed,uid,now,tier):
    difficulty=min(1,tier*.10+kg/60)
    return dict(version=5,id=uid,fish=fish,kg=kg,equipment=equipment,stats=stats,seed=seed,tier=tier,
        started=now,last=now,expires=now+86400,sequence=-1,phase='waiting',phase_time=0,fight_time=0,
        bite_after=max(1.8,5.5-stats.get('attraction',0)*2+seed*.15),hook_window=1.15+stats.get('hook_window',0),
        width=max(.13,min(.46,.28+stats.get('control',0)-difficulty*.10)),speed=max(.35,(.8+difficulty*1.7)*(1-min(.55,stats.get('stability',0)*.55))),
        progress=0,stamina=100,tension=.28,overload=0,slack=0,done=False,won=False,target=.5,score=0,cue='Ждём поклёвку')

def advance(b,now,position,reeling,hook,sequence):
    if sequence<=b.get('sequence',-1):return b
    gap=now-b['last'];dt=min(.4,max(0,gap)) if gap<1.5 else 0
    b['last']=now;b['sequence']=sequence;b['phase_time']+=dt
    if b['phase']=='waiting':
        if b['phase_time']>=b['bite_after']:b.update(phase='bite',phase_time=0,cue='Клюёт! Подсекай!')
        return b
    if b['phase']=='bite':
        if hook and b['phase_time']<=b['hook_window']:b.update(phase='fight',phase_time=0,cue='Рыба на крючке!')
        elif b['phase_time']>b['hook_window']:b.update(done=True,reason='Ты пропустил подсечку')
        return b
    b['fight_time']+=dt;t=b['fight_time'];stats=b['stats'];target=target_at(b);b['target']=target
    inside=abs(position-target)<=b['width']/2
    rush=(int(t/3.8)%3==1) and b['stamina']>15
    strength=max(1,stats.get('strength',3));load=min(2.5,b['kg']/strength)
    if reeling:
        gain=.035+load*.08+(.115 if rush else 0)+(0 if inside else .055)-stats.get('power',0)*.025
        b['tension']+=dt*max(.025,gain)*(1-min(.65,stats.get('elasticity',0)))
        if inside:
            b['progress']+=dt*(5+stats.get('retrieve',0)*4)*(1.05 if b['stamina']<20 else 1)*(.6 if rush else 1)
            b['stamina']=max(0,b['stamina']-dt*(5+stats.get('fatigue',0)*7+stats.get('power',0)*3))
        else:b['progress']=max(0,b['progress']-dt*1.2)
    else:
        b['tension']-=dt*(.22+stats.get('relief',0)*.25);b['progress']=max(0,b['progress']-dt*.3)
    b['tension']=max(0,min(1.1,b['tension']))
    b['overload']=b['overload']+dt if b['tension']>=1 else max(0,b['overload']-dt)
    b['slack']=b['slack']+dt if b['tension']<.035 else 0
    b['cue']='Рывок! Отпусти катушку' if rush else 'Сбрось натяжение' if b['tension']>.8 else 'Тяни, удерживая рыбу в зоне' if reeling else 'Леска отдыхает — следи за натяжением'
    if b['overload']>=.6:b.update(done=True,reason='Леска не выдержала натяжение')
    elif b['slack']>=2.5:b.update(done=True,reason='Леска провисла — рыба сорвалась')
    elif t>=100:b.update(done=True,reason='Рыба ушла в глубину')
    elif b['progress']>=100:b.update(done=True,won=True,progress=100)
    b['score']=b['progress']
    return b
