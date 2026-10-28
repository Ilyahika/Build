/* Viva V21 - Backpack visual redesign. Existing inventory actions remain server-backed. */
'use strict';
const viva21BagPrior=bagView;
bagView=function(){
  viva21BagPrior();
  const root=document.getElementById('view');
  if(!root || !S)return;
  root.classList.add('v21-backpack');
  root.dataset.bagSection=bagTab;
  root.dataset.gearCategory=bagTab==='gear'?category:'none';
  const title=root.querySelector('h1');
  if(title){
    const head=title.closest('.section-heading')||title.parentElement;
    head?.classList.add('v21-bag-heading');
    if(!head.querySelector('.v21-overline'))title.insertAdjacentHTML('beforebegin','<span class="v21-overline">VIVA / КОЛЛЕКЦИЯ</span>');
  }
  const sets=[
    {tab:'fish',label:'Улов',count:(S.catches||[]).length,icon:'🐟'},
    {tab:'gear',label:'Снасти',count:(S.gear||[]).reduce((n,g)=>n+(g.amount||1),0),icon:'🎣'},
    {tab:'tank',label:'Аквариум',count:(S.aquarium?.fish||[]).length,icon:'🫧'}
  ];
  const primary=root.querySelector('.bag-tabs');
  if(primary){
    primary.classList.add('v21-primary-tabs');
    [...primary.children].slice(0,3).forEach((el,i)=>{
      if(!sets[i])return;
      const s=sets[i];
      el.innerHTML=`<span class="v21-tab-icon">${s.icon}</span><span class="v21-tab-name">${s.label}</span><b class="v21-tab-count">${s.count}</b>`;
    });
  }
  if(bagTab==='gear'){
    const tabs=[...root.querySelectorAll('.bag-tabs')][1];
    if(tabs){tabs.classList.add('v21-gear-tabs');[...tabs.children].forEach(b=>{
      const val=(b.getAttribute('onclick')||'').match(/category='([^']+)'/)?.[1]||'';
      b.dataset.gear=val;
      const names={rod:'Удочки',reel:'Катушки',bait:'Приманки',line:'Леска',spoon:'Блёсны',spinner:'Вертушки',tackle:'Оснастка'};
      const icons={rod:'🎣',reel:'◉',bait:'◇',line:'〰',spoon:'✦',spinner:'✺',tackle:'⬡'};
      b.innerHTML=`<span class="v21-gear-icon">${icons[val]||'◆'}</span><span>${names[val]||b.textContent}</span>`;
    })}
  }
  const cards=[...root.querySelectorAll('.collection-grid > .collect-card')];
  cards.forEach((card,i)=>{
    card.classList.add('v21-item');
    card.style.setProperty('--v21-order',Math.min(i,12));
    if(bagTab==='gear')card.dataset.gear=category;
    let art=card.querySelector('.collect-art');
    if(art)art.classList.add('v21-item-art');
    const buttons=card.querySelectorAll('.card-actions button');
    buttons.forEach(b=>b.classList.add('v21-action'));
  });
  const loadout=root.querySelector('.loadout');if(loadout)loadout.classList.add('v21-loadout');
  root.querySelectorAll('.equipment-slot').forEach((slot,i)=>{
    slot.classList.add('v21-slot');
    slot.dataset.gear=Object.keys(labels).filter(k=>k!=='cases')[i]||'other';
  });
  const grid=root.querySelector('.collection-grid');if(grid)grid.classList.add('v21-collection');
  if(bagTab==='gear'&&grid&&!root.querySelector('.v21-collection-heading')){
    const heading=document.createElement('div');heading.className='v21-collection-heading';
    const names={rod:'Коллекция удочек',reel:'Коллекция катушек',bait:'Коллекция приманок',line:'Коллекция лесок',spoon:'Коллекция блёсен',spinner:'Коллекция вертушек'};
    heading.innerHTML=`<div><small>ИНВЕНТАРЬ</small><h2>${names[category]||'Мои снасти'}</h2></div><span>${(S.gear||[]).filter(g=>g.type===category).reduce((n,g)=>n+(g.amount||1),0)} / 6</span>`;
    grid.before(heading);
  }
  if(bagTab==='fish'&&grid&&!root.querySelector('.v21-collection-heading')){
    const heading=document.createElement('div');heading.className='v21-collection-heading';
    heading.innerHTML=`<div><small>ТВОИ ТРОФЕИ</small><h2>Пойманная рыба</h2></div><span>${(S.catches||[]).length} / 30</span>`;
    grid.before(heading);
  }
  root.querySelectorAll('canvas.v20-fish-canvas').forEach(v20DrawFish);
};
