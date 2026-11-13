(() => {
  'use strict';
  const C=MapugaCore,profile=MapugaProviders.get(document.body.dataset.provider),$=id=>document.getElementById(id);
  const root=$('lab-app');
  root.innerHTML=`<section class="lab-card lab-setup"><h2>Подключение ${profile.name}</h2><form id="key-form"><div id="key-fields" class="lab-key-grid"></div><button class="lab-button" id="connect" type="submit">${profile.keys.length?'Подключить API':'Открыть карту'}</button></form><p class="lab-small">Ключи остаются в памяти вкладки, не сохраняются и не добавляются к адресу страницы. SDK передаёт browser key провайдеру. После подключения запросы расходуют квоту сервиса.</p><div id="lab-status" class="lab-status" role="status">${profile.keys.length?'Введите свои browser API keys. Без них этот вариант не загружает чужую карту и не выдаёт её за выбранный API.':'Вариант без ключей. Для приложения с рекламой потребуется другая production-инфраструктура — см. требования ниже.'}</div></section><div class="lab-workspace"><aside class="lab-card lab-planner"><div class="lab-geo"><label class="lab-field">Страна<input id="lab-country" role="combobox" aria-controls="countries" aria-expanded="false" autocomplete="off"><div id="countries" class="lab-results" role="listbox" hidden></div></label><label class="lab-field">Город<input id="lab-city" role="combobox" aria-controls="cities" aria-expanded="false" autocomplete="off"><div id="cities" class="lab-results" role="listbox" hidden></div></label></div><div class="lab-search"><label class="lab-field">Добавить адрес<input id="lab-address" role="combobox" aria-autocomplete="list" aria-controls="addresses" aria-expanded="false" placeholder="Улица и номер дома" autocomplete="off" disabled></label><div id="addresses" class="lab-results" role="listbox" hidden></div><p class="lab-small">От 3 символов · выберите найденный адрес</p></div><ol id="lab-stops" class="lab-stops"></ol><div class="lab-actions"><button id="lab-build" class="lab-button dark" disabled>Построить маршрут</button><button id="lab-clear" class="lab-button secondary" disabled>Очистить</button><button id="lab-position" class="lab-button secondary" ${profile.navigation?'':'hidden'} disabled>Моя позиция — старт</button></div><p class="lab-small">До ${profile.maxPoints} точек · порядок меняется ↑ ↓</p><div id="lab-summary" class="lab-summary" hidden></div><section id="lab-guidance-controls" ${profile.navigation?'':'hidden'}><label class="lab-voice"><input id="lab-voice" type="checkbox" checked> Озвучивать повороты</label><div class="lab-actions"><button id="lab-navigate" class="lab-button" disabled>Начать навигацию</button><button id="lab-demo" class="lab-button secondary" disabled>Демо без GPS</button><button id="lab-export" class="lab-button secondary" disabled>GPX</button></div><p class="lab-small">Открытая вкладка, включённый экран, HTTPS или localhost. Реальная поездка ещё не проверена.</p></section><p class="lab-ad-policy">Реальной рекламы в HTML нет. План для Android: объявление на отдельном экране после поездки, вне GPS-ведения; основные функции останутся бесплатными.</p></aside><section class="lab-map-wrap" aria-label="Карта ${profile.name}"><div class="lab-map" id="provider-map"></div><div id="map-placeholder" class="lab-map-empty"><strong>${profile.name}</strong><span>${profile.keys.length?'Карта появится после подключения ключей':'Карта загружается…'}</span></div><section id="lab-navigation" class="lab-navigation" hidden><small id="nav-mode"></small><strong id="nav-title" role="status"></strong><p id="nav-distance"></p><p id="nav-destination"></p><button id="nav-next" hidden>К следующей остановке →</button><button id="nav-stop">Остановить</button></section></section></div>`;
  let city=C.CITIES[0],points=[],adapter=null,route=null,guidance=null,navigation=null,keys={},loading=false,searchTimer,searchController,routeController,generation=0,routeGeneration=0,lastSearchAt=0,lastRouteAt=0,selecting=false,suggestions=[],activeSuggestion=-1;
  const storageKey=`mapuga.variant.${profile.id}.v1`;
  if(profile.persist){try{const saved=C.restoreState(localStorage.getItem(storageKey),profile.maxPoints);if(saved){city=saved.city;points=saved.points;}}catch{}}
  function status(message,error=false){
    let text=String(message||'');for(const value of Object.values(keys))if(value&&value.length>8)text=text.split(value).join('[ключ]');
    $('lab-status').textContent=text;$('lab-status').classList.toggle('error',error);
  }
  function node(tag,text,className){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(className)n.className=className;return n;}
  function save(){if(profile.persist)try{localStorage.setItem(storageKey,JSON.stringify({version:1,cityId:city.id,points}));}catch{status('Сохранение в этом браузере недоступно.',true);}}
  function cancelSearch(){clearTimeout(searchTimer);generation++;searchController?.abort();suggestions=[];activeSuggestion=-1;$('addresses').hidden=true;$('addresses').replaceChildren();$('lab-address').setAttribute('aria-expanded','false');$('lab-address').removeAttribute('aria-activedescendant');}
  async function deadline(promise){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('API долго не отвечает. Попробуйте снова.')),25000);})]);}finally{clearTimeout(timer);}}
  function stop(){navigation?.stop();navigation=null;$('lab-navigation').hidden=true;adapter?.clearLocation?.();$('lab-navigate').textContent='Начать навигацию';$('lab-demo').disabled=!route;}
  function invalidate(){stop();routeGeneration++;routeController?.abort();route=null;guidance=null;loading=false;adapter?.clearRoute();$('lab-summary').hidden=true;render();}
  function render(){
    $('lab-country').value=MapugaCore.COUNTRIES.find(c=>c.code===city.country).name;$('lab-city').value=city.name;
    $('lab-address').disabled=!adapter||selecting||points.length>=profile.maxPoints;
    $('lab-build').disabled=!adapter||points.length<2||loading||!!route;$('lab-build').textContent=loading?'Строим…':'Построить маршрут';
    $('lab-clear').disabled=!points.length;$('lab-position').disabled=!adapter||points.length>=profile.maxPoints;
    $('lab-navigate').disabled=!guidance;$('lab-demo').disabled=!guidance||!!navigation;$('lab-export').disabled=!route||!profile.export;
    $('lab-stops').replaceChildren();
    points.forEach((p,index)=>{
      const li=node('li');li.append(node('span',index+1,'lab-stop-number'),node('span',p.title,'lab-stop-name'));
      const actions=node('div',null,'lab-stop-actions');
      for(const [label,delta] of [['↑',-1],['↓',1],['×',0]]){
        const button=node('button',label);button.type='button';button.setAttribute('aria-label',`${delta===0?'Удалить':delta<0?'Выше':'Ниже'}: ${p.title}`);button.disabled=delta!==0&&(index+delta<0||index+delta>=points.length);
        button.addEventListener('click',()=>{cancelSearch();if(delta)points=C.movePoint(points,index,index+delta);else points.splice(index,1);save();invalidate();});actions.append(button);
      }
      li.append(actions);$('lab-stops').append(li);
    });adapter?.markers(points);
  }
  function setCity(next){if(next.id===city.id)return;cancelSearch();city=next;points=[];save();invalidate();adapter?.city(city);status(`Выбран город ${city.name}. Список остановок очищен.`);}
  function picker(input,box,getMatches,label,select,committed){
    let matches=[],active=-1;
    function close(){box.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');input.value=committed();}
    function show(){matches=getMatches(input.value);active=-1;box.replaceChildren();input.removeAttribute('aria-activedescendant');
      matches.forEach((item,i)=>{const button=node('button',label(item),'lab-result');button.id=`${box.id}-${i}`;button.type='button';button.setAttribute('role','option');button.tabIndex=-1;button.addEventListener('mousedown',e=>e.preventDefault());button.addEventListener('click',()=>{select(item);close();input.select();});box.append(button);});
      if(!matches.length)box.append(node('p','Нет совпадений в справочнике','lab-small'));box.hidden=false;input.setAttribute('aria-expanded','true');}
    input.addEventListener('focus',()=>{input.value='';show();});input.addEventListener('input',show);input.addEventListener('click',()=>{if(box.hidden){input.value='';show();}});
    input.addEventListener('keydown',e=>{if(e.key==='Escape'||e.key==='Tab'){close();return;}if(!['ArrowDown','ArrowUp','Enter'].includes(e.key))return;e.preventDefault();if(box.hidden){input.value='';show();}if(!matches.length)return;if(e.key==='Enter'){select(matches[active<0?0:active]);close();input.select();return;}active=active<0?(e.key==='ArrowDown'?0:matches.length-1):(active+(e.key==='ArrowDown'?1:-1)+matches.length)%matches.length;[...box.children].forEach((b,i)=>b.classList.toggle('active',i===active));input.setAttribute('aria-activedescendant',box.children[active].id);box.children[active].scrollIntoView({block:'nearest'});});
    document.addEventListener('pointerdown',e=>{if(!input.parentElement.contains(e.target))close();});input.addEventListener('blur',()=>setTimeout(()=>{if(!input.parentElement.contains(document.activeElement))close();},0));
  }
  picker($('lab-country'),$('countries'),q=>C.findCountries(q),c=>c.name,c=>{if(c.code!==city.country)setCity(C.CITIES.find(x=>x.country===c.code));},()=>C.COUNTRIES.find(c=>c.code===city.country).name);
  picker($('lab-city'),$('cities'),q=>C.CITIES.filter(c=>c.country===city.country&&C.normalize(c.name).includes(C.normalize(q))),c=>c.name,setCity,()=>city.name);
  const fields=new Map();
  for(const [name,label]of profile.keys){const field=node('label',null,'lab-field');field.append(node('span',label));const input=node('input');input.type=name==='mapId'?'text':'password';input.autocomplete='off';input.spellcheck=false;input.required=!(name==='mapId'||profile.id==='2gis'&&name==='routeKey');input.setAttribute('aria-label',label);fields.set(name,input);field.append(input);$('key-fields').append(field);}
  $('key-form').addEventListener('submit',async event=>{
    event.preventDefault();if(adapter)return;keys=Object.fromEntries([...fields].map(([name,input])=>[name,input.value.trim()]));
    if([...fields].some(([,input])=>input.required&&!input.value.trim())){status('Заполните обязательные поля ключей.',true);return;}
    $('connect').disabled=true;status('Подключаем SDK провайдера…');
    try{adapter=await MapugaAdapters.create(profile.id,keys,$('provider-map'),city,msg=>status(msg,true));adapter.city(city);$('map-placeholder').hidden=true;fields.forEach(input=>input.disabled=true);$('connect').textContent='SDK подключён · для другого ключа перезагрузите страницу';render();if(points.length)adapter.fit(points);status(`${profile.name}: SDK подключён. Доступность карты, поиска и маршрута зависит от ключа, продуктов, домена и квоты.`);}
    catch(error){status(error.message,true);$('connect').disabled=false;}
  });
  async function choose(point){
    if(!adapter||points.length>=profile.maxPoints)return;
    const currentCity=city,version=++generation;clearTimeout(searchTimer);searchController?.abort();$('addresses').hidden=true;selecting=true;render();
    try{const resolved=await deadline(adapter.resolve(point,currentCity));if(version!==generation||city.id!==currentCity.id)return;if(!C.validPoint(resolved)||!C.isInCity(resolved,city))throw new Error('Некорректная точка или адрес вне выбранного города.');if(points.some(p=>p.id===resolved.id||Math.abs(p.lat-resolved.lat)<.00001&&Math.abs(p.lon-resolved.lon)<.00001))throw new Error('Этот адрес уже есть в списке.');points.push(resolved);$('lab-address').value='';save();invalidate();status(`Добавлено: ${resolved.title}`);}
    catch(error){if(version===generation)status(error.message,true);}finally{selecting=false;render();}
  }
  function search(){
    cancelSearch();suggestions=[];activeSuggestion=-1;const query=$('lab-address').value.trim();if(query.length<3||!adapter)return;
    const version=generation,currentCity=city;searchTimer=setTimeout(async()=>{
      if(version!==generation)return;searchController=new AbortController();lastSearchAt=Date.now();status('Ищем адреса…');
      try{const results=await deadline(adapter.search(query,currentCity,searchController.signal));if(version!==generation)return;suggestions=results;const list=$('addresses');list.replaceChildren();results.forEach((p,i)=>{const button=node('button',null,'lab-result');button.id=`address-option-${i}`;button.type='button';button.setAttribute('role','option');button.tabIndex=-1;button.append(node('strong',p.title),node('small',p.subtitle));button.addEventListener('mousedown',e=>e.preventDefault());button.addEventListener('click',()=>choose(p));list.append(button);});if(!results.length)list.append(node('p','Адрес не найден. Попробуйте другой запрос.','lab-small'));list.hidden=false;$('lab-address').setAttribute('aria-expanded','true');status(`Найдено: ${results.length}. Выберите подходящий адрес.`);}
      catch(error){if(version===generation&&error.name!=='AbortError')status(error.message,true);}
    },Math.max(650,lastSearchAt+1100-Date.now()));
  }
  $('lab-address').addEventListener('input',search);
  $('lab-address').addEventListener('keydown',e=>{if(e.key==='Escape'){cancelSearch();return;}if(e.key==='Enter'){e.preventDefault();if(suggestions[activeSuggestion<0?0:activeSuggestion])choose(suggestions[activeSuggestion<0?0:activeSuggestion]);return;}if(!['ArrowDown','ArrowUp'].includes(e.key)||!suggestions.length)return;e.preventDefault();activeSuggestion=activeSuggestion<0?(e.key==='ArrowDown'?0:suggestions.length-1):(activeSuggestion+(e.key==='ArrowDown'?1:-1)+suggestions.length)%suggestions.length;[...$('addresses').children].forEach((n,i)=>n.classList.toggle('active',i===activeSuggestion));$('lab-address').setAttribute('aria-activedescendant',`address-option-${activeSuggestion}`);$('addresses').children[activeSuggestion].scrollIntoView({block:'nearest'});});
  $('lab-build').addEventListener('click',async()=>{
    if(!adapter||points.length<2||loading)return;cancelSearch();stop();const version=++routeGeneration,current=points.slice();routeController=new AbortController();loading=true;render();status('Строим маршрут…');
    try{const delay=lastRouteAt+1100-Date.now();if(delay>0)await new Promise(resolve=>setTimeout(resolve,delay));if(version!==routeGeneration)return;lastRouteAt=Date.now();const result=await deadline(adapter.route(current,routeController.signal));if(version!==routeGeneration)return;adapter.drawRoute(result);route=result;$('lab-summary').textContent=`${C.formatDistance(result.distance)} · ${C.formatDuration(result.duration)} · остановок: ${current.length}`;$('lab-summary').hidden=false;if(profile.navigation){try{guidance=MapugaNavigation.prepare(result,current);}catch(error){status(`Маршрут готов, но навигация недоступна: ${error.message}`,true);return;}}status('Маршрут готов. Время расчётное; возможности и лицензия указаны ниже.');}
    catch(error){if(version===routeGeneration&&error.name!=='AbortError'){route=null;guidance=null;adapter.clearRoute();status(error.message,true);}}finally{if(version===routeGeneration){loading=false;render();}}
  });
  $('lab-clear').addEventListener('click',()=>{cancelSearch();points=[];save();invalidate();status('Список очищен.');});
  $('lab-position').addEventListener('click',()=>{
    if(!isSecureContext||!navigator.geolocation){status('Геолокация требует HTTPS/localhost и разрешения браузера.',true);return;}
    const cityId=city.id;$('lab-position').disabled=true;navigator.geolocation.getCurrentPosition(position=>{
      $('lab-position').disabled=false;const point={id:'gps',title:'Моя позиция',subtitle:city.name,lat:position.coords.latitude,lon:position.coords.longitude};
      if(cityId!==city.id||!C.validPoint(point)||!C.isInCity(point,city)||position.coords.accuracy>80){status('Позиция неточная или вне выбранного города.',true);return;}
      const rest=points.filter(p=>p.id!=='gps');if(rest.length>=profile.maxPoints)return;points=[point,...rest];save();invalidate();adapter.fit(points);status('Позиция добавлена в начало. Постройте путь.');
    },()=>{render();status('Не удалось получить геолокацию. Проверьте разрешение и сигнал GPS.',true);},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
  });
  function navigate(mode){
    if(navigation){stop();render();return;}if(!guidance)return;if(mode==='gps'&&(!isSecureContext||!navigator.geolocation)){status('Для GPS нужен HTTPS или localhost.',true);return;}
    navigation=MapugaNavigationSession.create({plan:guidance,mode,voice:$('lab-voice').checked,onFix:fix=>adapter.location(fix),onError:message=>{stop();render();status(message,true);},onUpdate:r=>{
      $('lab-navigation').hidden=false;$('nav-mode').textContent=r.mode==='demo'?'ДЕМО · БЕЗ GPS':'НАВИГАЦИЯ · GPS';$('nav-next').hidden=r.status!=='stop';
      const messages={waiting:'Ожидаем позицию…',paused:'Вкладка скрыта · навигация приостановлена',weak:'Недостаточная точность GPS',stale:'Потерян сигнал GPS',offroute:'Вы вне маршрута. Остановитесь и перестройте путь.',start:'Вы далеко от старта. Добавьте свою позицию в начало.'};
      $('nav-title').textContent=['onroute','stop','arrived'].includes(r.status)?r.event?.text||'Маршрут завершён':messages[r.status]||'Ожидаем позицию';
      $('nav-distance').textContent=r.status==='onroute'?r.distance<=25?'Сейчас':`Через ${C.formatDistance(r.distance)}`:Number.isFinite(r.remaining)?`До финиша: ${C.formatDistance(r.remaining)}`:'';
      $('nav-destination').textContent=r.event?.type==='arrive'?r.event.destination:r.event?.road||'';
    }});$('lab-navigate').textContent='Остановить навигацию';$('lab-demo').disabled=true;navigation.start();
  }
  $('lab-navigate').addEventListener('click',()=>navigate('gps'));$('lab-demo').addEventListener('click',()=>navigate('demo'));$('nav-stop').addEventListener('click',()=>{stop();render();});$('nav-next').addEventListener('click',()=>navigation?.nextLeg());$('lab-voice').addEventListener('change',()=>navigation?.setVoice($('lab-voice').checked));
  if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){$('lab-voice').checked=false;$('lab-voice').disabled=true;}
  $('lab-export').addEventListener('click',()=>{if(!route||!profile.export)return;const url=URL.createObjectURL(new Blob([C.toGpx(points,route)],{type:'application/gpx+xml;charset=utf-8'}));const link=node('a');link.href=url;link.download=`mapuga-${profile.id}.gpx`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)navigation?.pause();else navigation?.resume();});window.addEventListener('pagehide',()=>{stop();cancelSearch();routeController?.abort();adapter?.destroy();});
  render();if(!profile.keys.length)$('key-form').requestSubmit();
})();
