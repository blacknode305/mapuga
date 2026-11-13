(function(){
  'use strict';
  const F=window.MapugaFleet,C=window.MapugaCore,$=id=>document.getElementById(id),storageKey='mapuga.fleet-demo.v1',city=C.CITIES.find(c=>c.id==='karaganda');
  let state,actor,selectedId,stops=[],searchTimer,searchController,routeController,searchVersion=0,busy=false,lastSearch=0,lastRoute=0;
  try{state=F.restore(localStorage.getItem(storageKey))||F.demo();}catch{state=F.demo();}
  actor=new URLSearchParams(location.search).get('org');if(!F.organization(state,actor))actor=state.organizations[0].id;
  const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('mapuga-fleet-demo'):null;
  const node=(tag,value,className)=>{const el=document.createElement(tag);if(value!=null)el.textContent=value;if(className)el.className=className;return el;};
  const labelState={ready:'Готов к отправлению',moving:'В пути · симуляция ×10',paused:'Демо на паузе',arrived:'Рейс завершён'};
  const map=L.map('map',{zoomControl:true}).setView([49.806,73.09],13),lines=L.layerGroup().addTo(map),pins=new Map();
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'}).addTo(map);
  function message(value,error=false){$('message').textContent=value;$('message').hidden=false;$('message').classList.toggle('error',error);}
  function org(){return F.organization(state,actor);}
  function recipients(){return state.organizations.filter(o=>o.kind==='recipient');}
  function visible(){return F.visibleTrips(state,actor);}
  function vehicle(trip){return state.vehicles.find(v=>v.id===trip.vehicleId);}
  function owner(trip){return F.organization(state,trip.ownerId);}
  function write(){
    try{localStorage.setItem(storageKey,JSON.stringify(state));channel?.postMessage({type:'changed'});}catch{message('Данные не удалось сохранить. Демо работает в памяти; синхронизация вкладок недоступна.',true);}
    render();
  }
  function sync(){try{const next=F.restore(localStorage.getItem(storageKey));if(next){state=next;if(!F.organization(state,actor))actor=state.organizations[0].id;render();}}catch{}}
  window.addEventListener('storage',event=>{if(event.key===storageKey)sync();});if(channel)channel.onmessage=sync;
  function options(select,items,preferred){const previous=preferred??select.value;select.replaceChildren();for(const item of items){const opt=node('option',item.label);opt.value=item.id;select.append(opt);}if(items.some(i=>i.id===previous))select.value=previous;}
  function checks(container,grants=[]){container.replaceChildren();for(const recipient of recipients()){const label=node('label',null,'check'),input=node('input');input.type='checkbox';input.value=recipient.id;input.checked=grants.includes(recipient.id);label.append(input,node('span',recipient.name));container.append(label);}if(!recipients().length)container.append(node('p','Сначала добавьте организацию-получателя.','hint'));}
  function cancelSearch(){clearTimeout(searchTimer);searchController?.abort();searchVersion++;$('suggestions').replaceChildren();$('suggestions').hidden=true;$('address').setAttribute('aria-expanded','false');}
  function render(){
    if(!visible().some(t=>t.id===selectedId))selectedId=visible()[0]?.id;
    const current=org(),isSupplier=current.kind==='supplier';
    options($('actor'),state.organizations.map(o=>({id:o.id,label:o.name})),actor);
    $('actor-kind').textContent=isSupplier?'ДИСПЕТЧЕР':'ПОЛУЧАТЕЛЬ';$('supplier-tools').hidden=!isSupplier;$('route-tools').hidden=!isSupplier;
    $('trips-heading').textContent=isSupplier?'Рейсы организации':'Доступные поставки';$('trip-count').textContent=visible().length;
    $('view-title').textContent=isSupplier?'Ваш автопарк':'Поставки вашей организации';$('view-subtitle').textContent=`${current.name} · только разрешённые рейсы`;
    const partner=recipients().find(r=>visible().some(t=>t.grants.includes(r.id)))||recipients()[0];
    $('partner-link').hidden=!isSupplier||!partner;if(partner)$('partner-link').href=`fleet-demo.html?org=${encodeURIComponent(partner.id)}`;
    const available=state.vehicles.filter(v=>v.ownerId===actor);options($('route-vehicle'),available.map(v=>({id:v.id,label:`${v.plate} · ${v.label}`})));
    $('vehicles').replaceChildren(...available.map(v=>node('div',`${v.plate} · ${v.label}`)));
    const grantSelection=[...$('route-grants').querySelectorAll('input:checked')].map(i=>i.value);checks($('route-grants'),grantSelection);
    renderStops();renderTrips();draw();tick();
  }
  function renderTrips(){
    $('trips').replaceChildren();const trips=visible();
    if(!trips.length){$('trips').append(node('p',org().kind==='supplier'?'Добавьте машину и назначьте маршрут.':'Поставщики пока не открыли вам доступ ни к одному рейсу.','hint'));return;}
    for(const trip of trips){
      const card=node('article',null,`trip${trip.id===selectedId?' active':''}`);card.dataset.tripId=trip.id;
      const head=node('div',null,'trip-top');head.append(node('span',trip.title,'trip-title'),node('span',vehicle(trip).plate,'plate'));card.append(head,node('p',`${owner(trip).name} · ${vehicle(trip).label}`));
      card.append(node('p',`Куда: ${trip.stops.at(-1).title}`));
      const status=node('div',null,'trip-status');status.dataset.tripStatus=trip.id;card.append(status);
      const actions=node('div',null,'trip-actions'),view=node('button','На карте','button small secondary');view.dataset.action='select';actions.append(view);
      if(org().kind==='supplier'){
        const control=node('button',F.position(trip).state==='moving'?'Пауза':'Запустить демо','button small');control.dataset.action='toggle';control.dataset.control=trip.id;actions.append(control);
        for(const [action,text] of [['reset','Сначала'],['finish','Завершить']]){const button=node('button',text,'button small secondary');button.dataset.action=action;actions.append(button);}
      }
      card.append(actions);
      if(org().kind==='supplier'){
        const details=node('details',null,'access');details.append(node('summary','Доступ к рейсу'));
        const form=node('form'),group=node('div');checks(group,trip.grants);const save=node('button','Сохранить доступ','button small secondary');save.type='submit';form.append(group,save);form.dataset.access=trip.id;details.append(form);card.append(details);
      }
      $('trips').append(card);
    }
  }
  function renderStops(){
    $('stops').replaceChildren();stops.forEach((point,i)=>{const li=node('li');li.append(node('span',point.title));for(const [action,label] of [['up','↑'],['down','↓'],['remove','×']]){const button=node('button',label);button.type='button';button.dataset.stopIndex=i;button.dataset.stopAction=action;button.setAttribute('aria-label',`${action==='remove'?'Удалить':action==='up'?'Выше':'Ниже'}: ${point.title}`);button.disabled=busy||action==='up'&&i===0||action==='down'&&i===stops.length-1;li.append(button);}$('stops').append(li);});
    $('assign').disabled=busy||stops.length<2||!$('route-vehicle').value;$('assign').textContent=busy?'Строим маршрут…':'Построить и назначить';$('address').disabled=busy||stops.length>=10;
  }
  function focusTrip(trip){if(trip)map.fitBounds(L.latLngBounds(trip.coordinates),{padding:[45,45],maxZoom:15});}
  function draw(){
    lines.clearLayers();for(const marker of pins.values())marker.remove();pins.clear();
    for(const trip of visible()){
      const color=trip.ownerId==='fresh'?'#786693':'#257456',line=L.polyline(trip.coordinates,{color,weight:trip.id===selectedId?5:3,opacity:trip.id===selectedId?.85:.4,dashArray:trip.illustrative?'8 8':null}).addTo(lines);
      line.on('click',()=>selectTrip(trip.id));
      const body=node('div',vehicle(trip).plate),icon=L.divIcon({className:`fleet-pin${trip.ownerId==='fresh'?' alt':''}`,html:body,iconSize:[86,33],iconAnchor:[43,17]});
      const p=F.position(trip),marker=L.marker([p.lat,p.lon],{icon,title:`${owner(trip).name} · ${vehicle(trip).plate}`}).addTo(map);marker.on('click',()=>selectTrip(trip.id));pins.set(trip.id,marker);
    }
  }
  function selectTrip(id){selectedId=id;renderTrips();draw();tick();focusTrip(visible().find(t=>t.id===id));}
  function tick(){
    const now=Date.now(),trips=visible(),snapshot=trips.map(t=>[t,F.position(t,now)]);
    $('updated').textContent=`Демо · ${new Date(now).toLocaleTimeString('ru')}`;$('stat-visible').textContent=trips.length;$('stat-moving').textContent=snapshot.filter(([,p])=>p.state==='moving').length;
    for(const [trip,p] of snapshot){
      pins.get(trip.id)?.setLatLng([p.lat,p.lon]);const status=$('trips').querySelector(`[data-trip-status="${CSS.escape(trip.id)}"]`);if(status)status.textContent=`${labelState[p.state]} · ${Math.round(p.progress*100)}%`;
      const control=$('trips').querySelector(`[data-control="${CSS.escape(trip.id)}"]`);if(control){control.textContent=p.state==='moving'?'Пауза':'Запустить демо';control.disabled=p.state==='arrived';}
    }
    const pair=snapshot.find(([t])=>t.id===selectedId);$('selected').replaceChildren();$('stat-vehicle').textContent=pair?vehicle(pair[0]).plate:'—';
    if(!pair){$('selected').append(node('h2','Здесь появятся разрешённые рейсы'),node('p','Доступ выдаёт организация-поставщик.','hint'));return;}
    const [trip,p]=pair;$('selected').append(node('span',owner(trip).name,'badge'),node('h2',`${vehicle(trip).plate} · ${trip.title}`),node('p',`${labelState[p.state]} · ${C.formatDistance(trip.distance)} · расчётное оставшееся время ${p.remaining>0?C.formatDuration(p.remaining):'0 мин'}`,'hint'));
    const bar=node('div',null,'progress'),fill=node('span');fill.style.width=`${p.progress*100}%`;bar.append(fill);$('selected').append(bar,node('p',trip.illustrative?'Исходная траектория условная, не маршрут по дорогам. Движение не является GPS.':'Маршрут построен OSRM по дорогам. Положение машины — симуляция, не GPS.','hint'));
    const list=node('ol',null,'route-stops');for(const stop of trip.stops)list.append(node('li',stop.title));$('selected').append(list);
  }
  $('actor').addEventListener('change',()=>{cancelSearch();routeController?.abort();busy=false;actor=$('actor').value;stops=[];$('address').value='';$('route-title').value='';$('message').hidden=true;selectedId=null;render();focusTrip(visible()[0]);});
  $('org-form').addEventListener('submit',event=>{event.preventDefault();try{const form=new FormData(event.currentTarget),created=F.register(state,{name:form.get('name'),kind:form.get('kind')});actor=created.id;stops=[];selectedId=null;event.currentTarget.reset();write();message(`«${created.name}» добавлена в локальное демо.`);}catch(error){message(error.message,true);}});
  $('vehicle-form').addEventListener('submit',event=>{event.preventDefault();try{const form=new FormData(event.currentTarget),created=F.addVehicle(state,actor,{plate:form.get('plate'),label:form.get('label')});event.currentTarget.reset();write();$('route-vehicle').value=created.id;renderStops();message(`Машина ${created.plate} добавлена.`);}catch(error){message(error.message,true);}});
  $('route-vehicle').addEventListener('change',renderStops);
  $('trips').addEventListener('click',event=>{const button=event.target.closest('button[data-action]');if(!button)return;const id=button.closest('[data-trip-id]').dataset.tripId;if(button.dataset.action==='select'){selectTrip(id);return;}try{const trip=state.trips.find(t=>t.id===id),action=button.dataset.action==='toggle'?(F.position(trip).state==='moving'?'pause':'start'):button.dataset.action;F.control(state,actor,id,action);write();message('Состояние демо-рейса обновлено.');}catch(error){message(error.message,true);}});
  $('trips').addEventListener('submit',event=>{const form=event.target.closest('form[data-access]');if(!form)return;event.preventDefault();try{F.setAccess(state,actor,form.dataset.access,[...form.querySelectorAll('input:checked')].map(i=>i.value));write();message('Доступ обновлён. Открытые вкладки получателей получат изменение.');}catch(error){message(error.message,true);}});
  $('stops').addEventListener('click',event=>{const button=event.target.closest('button[data-stop-action]');if(!button)return;const i=Number(button.dataset.stopIndex),action=button.dataset.stopAction;if(action==='remove')stops.splice(i,1);else stops=C.movePoint(stops,i,i+(action==='up'?-1:1));renderStops();});
  async function json(url,signal){const response=await fetch(url,{signal});if(!response.ok)throw new Error(`Сервис временно недоступен (HTTP ${response.status}).`);return response.json();}
  $('address').addEventListener('input',()=>{
    cancelSearch();const query=$('address').value.trim();if(query.length<3||busy)return;const version=searchVersion;
    searchTimer=setTimeout(async()=>{searchController=new AbortController();const controller=searchController;lastSearch=Date.now();const timer=setTimeout(()=>controller.abort(),20000);
      try{const data=await json(C.photonUrl('https://photon.komoot.io/api/',query,city),controller.signal);if(version!==searchVersion)return;const found=C.photonPoints(data,city);$('suggestions').replaceChildren();
        for(const point of found){const button=node('button',point.title);button.type='button';button.setAttribute('role','option');button.append(node('small',point.subtitle));button.addEventListener('click',()=>{if(stops.some(s=>s.id===point.id)){message('Этот адрес уже выбран.',true);return;}stops.push(point);$('address').value='';cancelSearch();renderStops();});$('suggestions').append(button);}
        if(!found.length)$('suggestions').append(node('p','Адрес не найден.','hint'));$('suggestions').hidden=false;$('address').setAttribute('aria-expanded','true');
      }catch(error){if(version===searchVersion)message(error.name==='AbortError'?'Поиск не ответил вовремя. Повторите запрос.':error.message,true);}finally{clearTimeout(timer);}
    },Math.max(700,lastSearch+1200-Date.now()));
  });
  $('address').addEventListener('keydown',event=>{if(event.key==='Escape')cancelSearch();if(event.key==='Enter'){event.preventDefault();$('suggestions').querySelector('button')?.focus();}if(event.key==='ArrowDown'){event.preventDefault();$('suggestions').querySelector('button')?.focus();}});
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('.address-wrap'))cancelSearch();});
  $('route-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy||stops.length<2)return;const currentActor=actor,currentStops=stops.map(p=>({...p})),vehicleId=$('route-vehicle').value,title=$('route-title').value,grants=[...$('route-grants').querySelectorAll('input:checked')].map(i=>i.value);
    const candidate=F.restore(state);try{F.assign(candidate,currentActor,{vehicleId,title,stops:currentStops,coordinates:currentStops.map(p=>[p.lat,p.lon]),duration:1,distance:0,grants});}catch(error){message(error.message,true);return;}
    cancelSearch();busy=true;renderStops();message('Строим маршрут по дорогам…');const controller=new AbortController();routeController=controller;const timer=setTimeout(()=>controller.abort(),25000);
    try{const delay=lastRoute+1200-Date.now();if(delay>0)await new Promise(resolve=>setTimeout(resolve,delay));if(controller.signal.aborted)return;lastRoute=Date.now();const data=await json(C.routeUrl('https://router.project-osrm.org',currentStops),controller.signal);if(actor!==currentActor||controller.signal.aborted)return;const route=C.parseRoute(data,currentStops.length);const trip=F.assign(state,currentActor,{vehicleId,title,stops:currentStops,coordinates:route.coordinates,duration:route.duration,distance:route.distance,grants});selectedId=trip.id;stops=[];$('route-title').value='';write();focusTrip(trip);message('Маршрут назначен. Нажмите «Запустить демо», чтобы показать движение.');}
    catch(error){if(actor===currentActor)message(error.name==='AbortError'?'Маршрутизатор не ответил вовремя. Повторите запрос.':error.message,true);}finally{clearTimeout(timer);if(routeController===controller){busy=false;routeController=null;renderStops();}}
  });
  $('reset-demo').addEventListener('click',()=>{cancelSearch();routeController?.abort();routeController=null;busy=false;state=F.demo();actor=state.organizations[0].id;stops=[];selectedId=null;write();focusTrip(visible()[0]);message('Исходные вымышленные данные восстановлены.');});
  window.addEventListener('pagehide',()=>{cancelSearch();routeController?.abort();channel?.close();clearInterval(ticker);});
  render();focusTrip(visible()[0]);const ticker=setInterval(tick,1000);
  try{if(!localStorage.getItem(storageKey))localStorage.setItem(storageKey,JSON.stringify(state));}catch{}
})();
