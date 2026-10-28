'use strict';
/* Final-release presentation layer. Game actions remain on authenticated API. */
const v18OldFish=fishView;
fishView=function(){
  v18OldFish();
  const l=S?.locations?.[loc],record=S?.location_records?.[l?.key];
  if(!l)return;
  const details=document.querySelector('.v17-location-details');
  if(details){const el=document.createElement('div');el.className='v18-record';el.innerHTML=`<small>ЛИЧНЫЙ РЕКОРД ЛОКАЦИИ</small><strong>${record?`${esc(record.fish)} · ${weightText(record.kg)} кг`:'Пока нет улова'}</strong><span>${record?esc(S.catalog.rarities[record.rarity]||record.rarity):'Лови рыбу, чтобы установить рекорд'}</span>`;details.after(el)}
  const scenes=document.querySelectorAll('.scene-wrap,.viva-location-buttons');scenes.forEach(x=>x.classList.add('v18-soft-enter'));
};
const v18OldCase=caseView;
caseView=function(){v18OldCase();const root=$('view');root.classList.add('v18-case-page');const odds=root.querySelector('.viva-case-chances');if(odds){odds.classList.add('v18-odds');odds.querySelectorAll('.odds-row').forEach((el,i)=>el.style.setProperty('--index',i))};const btn=$('case-open');if(btn&&!btn.disabled){btn.classList.add('v18-open-btn');btn.setAttribute('aria-label','Открыть выбранное количество кейсов')}};
const v18OldRewards=rewardsView;
rewardsView=function(){v18OldRewards();document.querySelectorAll('.v17-reward-card').forEach((el,i)=>{el.style.setProperty('--delay',`${i*100}ms`);el.classList.add('v18-enter')});};
const v18OldBag=bagView;
bagView=function(){v18OldBag();document.querySelectorAll('.collect-card,.viva-fish-card,.v15-fish-card').forEach((el,i)=>{if(i>80)return;el.style.setProperty('--delay',`${Math.min(i,12)*35}ms`);el.classList.add('v18-enter')})};
const v18OldTop=topView;
topView=function(){v18OldTop();document.querySelectorAll('#top-list > *').forEach((el,i)=>{el.classList.add('v18-enter');el.style.setProperty('--delay',`${Math.min(i,10)*45}ms`)})};
const v18OldAdmin=adminView;
adminView=function(){v18OldAdmin();document.querySelector('#view')?.classList.add('v18-admin')};
/* Clear release UI on real, on-device reduced-motion settings. */
