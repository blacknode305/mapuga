(() => {
  'use strict';
  const C=window.MapugaCore,D=window.MapugaProviderData;
  const scripts=new Map();
  function load(url){
    if(scripts.has(url))return scripts.get(url);
    const promise=new Promise((resolve,reject)=>{
      const s=document.createElement('script');let done=false;
      const timer=setTimeout(()=>{if(!done){done=true;reject(new Error('SDK долго не загружается. Проверьте интернет и доменные ограничения.'));}},20000);
      s.src=url;s.async=true;
      s.onload=()=>{if(!done){done=true;clearTimeout(timer);resolve();}};
      s.onerror=()=>{if(!done){done=true;clearTimeout(timer);reject(new Error('Не удалось загрузить SDK провайдера.'));}};
      document.head.append(s);
    });
    scripts.set(url,promise);return promise;
  }
  async function json(url,options={}){
    const timeout=new AbortController(), timer=setTimeout(()=>timeout.abort(),22000);
    const abort=()=>timeout.abort();options.signal?.addEventListener('abort',abort,{once:true});
    try{
      if(options.signal?.aborted)throw new DOMException('Отменено','AbortError');
      const response=await fetch(url,{...options,signal:timeout.signal,credentials:'omit'});
      if(!response.ok)throw new Error(response.status===429?'Достигнут лимит сервиса. Повторите позже.':`API: HTTP ${response.status}. Проверьте ключ, продукт, домен и тариф.`);
      return await response.json();
    }catch(error){if(options.signal?.aborted)throw new DOMException('Отменено','AbortError');if(error.name==='AbortError')throw new Error('API не ответил вовремя.');if(error instanceof TypeError)throw new Error('Сетевая ошибка API. Проверьте интернет, CORS и ограничения ключа.');throw error;}
    finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}
  }
  const lonLat=p=>[p.lon,p.lat];
  function extent(points){const c=points.map(lonLat);return [[Math.min(...c.map(p=>p[0])),Math.min(...c.map(p=>p[1]))],[Math.max(...c.map(p=>p[0])),Math.max(...c.map(p=>p[1]))]];}
  function pin(n){const node=document.createElement('span');node.className='lab-pin';node.textContent=n;return node;}
  function finitePoint(id,title,subtitle,c,city){const p={id,title,subtitle:subtitle||city.name,lon:c?.[0],lat:c?.[1],kind:'Место'};if(!C.validPoint(p)||!C.isInCity(p,city))throw new Error('Место находится вне области выбранного города.');return p;}
  async function create(id,keys,element,city,onFailure){
    let map,markers=[],line=null,locationMarker=null,token=null;
    const adapter={id,async resolve(point){return point;},destroy(){}};
    if(id==='osm'||id==='geoapify'){
      map=L.map(element,{zoomControl:true,minZoom:3,maxZoom:19}).setView([city.lat,city.lon],13);
      const tile=id==='osm'?'https://tile.openstreetmap.org/{z}/{x}/{y}.png':`https://maps.geoapify.com/v1/tile/osm-carto/{z}/{x}/{y}.png?apiKey=${encodeURIComponent(keys.apiKey)}`;
      const attribution='© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'+(id==='geoapify'?' · Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener">Geoapify</a>':'');
      let good=0,bad=0;L.tileLayer(tile,{attribution,keepBuffer:1,updateWhenIdle:true}).on('tileload',()=>good++).on('tileerror',()=>{if(!good&&++bad===3)onFailure('Тайлы не загрузились. Проверьте ключ, квоту и соединение.');}).addTo(map);
      adapter.city=c=>map.setView([c.lat,c.lon],13);
      adapter.markers=points=>{markers.forEach(m=>m.remove());markers=points.map((p,i)=>L.marker([p.lat,p.lon],{title:p.title,icon:L.divIcon({className:'',html:pin(i+1).outerHTML,iconSize:[30,30],iconAnchor:[15,15]})}).addTo(map));};
      adapter.clearRoute=()=>{line?.remove();line=null;};
      adapter.drawRoute=route=>{adapter.clearRoute();line=L.polyline(route.coordinates,{color:'#315e48',weight:5}).addTo(map);map.fitBounds(line.getBounds(),{padding:[35,45],maxZoom:16});};
      adapter.location=fix=>{const c=[fix.lat,fix.lon];if(locationMarker)locationMarker.setLatLng(c);else locationMarker=L.circleMarker(c,{radius:7,color:'#fff',weight:3,fillColor:'#4d91c5',fillOpacity:1,interactive:false}).addTo(map);map.setView(c,Math.max(16,map.getZoom()),{animate:false});};
      adapter.clearLocation=()=>{locationMarker?.remove();locationMarker=null;};
      adapter.fit=points=>{if(points.length)map.fitBounds(points.map(p=>[p.lat,p.lon]),{padding:[40,45],maxZoom:16});};
      adapter.destroy=()=>map.remove();
      adapter.search=async(query,c,signal)=>{
        if(id==='osm')return C.photonPoints(await json(C.photonUrl('https://photon.komoot.io/api/',query,c),{signal}),c);
        const url=new URL('https://api.geoapify.com/v1/geocode/autocomplete');
        url.search=new URLSearchParams({text:query,lang:'ru',limit:'7',filter:`rect:${C.cityBounds(c).join(',')}|countrycode:${c.country.toLowerCase()}`,bias:`proximity:${c.lon},${c.lat}`,apiKey:keys.apiKey});
        return D.geoSearch(await json(url,{signal}),c);
      };
      adapter.route=async(points,signal)=>{
        if(id==='osm')return C.parseRoute(await json(C.routeUrl('https://router.project-osrm.org',points),{signal}),points.length);
        const url=new URL('https://api.geoapify.com/v1/routing');
        url.search=new URLSearchParams({waypoints:points.map(p=>`${p.lat},${p.lon}`).join('|'),mode:'drive',lang:'ru',units:'metric',details:'instruction_details',intermediate_waypoint_mode:'stopover',apiKey:keys.apiKey});
        return D.geoRoute(await json(url,{signal}),points.length);
      };
    }else if(id==='google'){
      window.gm_authFailure=()=>onFailure('Google отклонил ключ. Проверьте billing, разрешённый Referer и включённые API. После исправления перезагрузите страницу.');
      const url=new URL('https://maps.googleapis.com/maps/api/js');url.search=new URLSearchParams({key:keys.apiKey,v:'weekly',loading:'async',language:'ru',libraries:'maps,places,routes,marker',callback:'__mapugaGoogleReady'});
      await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(new Error('Google Maps SDK не завершил загрузку. Проверьте ключ и соединение.')),25000);
        window.__mapugaGoogleReady=()=>{clearTimeout(timer);resolve();};
        window.gm_authFailure=()=>{clearTimeout(timer);const message='Google отклонил ключ. Проверьте billing, Referer и API.';onFailure(message);reject(new Error(message));};
        load(url.href).catch(error=>{clearTimeout(timer);reject(error);});
      });
      const [{Map},{AdvancedMarkerElement},{AutocompleteSuggestion,AutocompleteSessionToken},{Route}]=await Promise.all([google.maps.importLibrary('maps'),google.maps.importLibrary('marker'),google.maps.importLibrary('places'),google.maps.importLibrary('routes')]);
      map=new Map(element,{center:{lat:city.lat,lng:city.lon},zoom:13,mapId:keys.mapId||'DEMO_MAP_ID',mapTypeControl:false,streetViewControl:false});
      adapter.city=c=>{map.setCenter({lat:c.lat,lng:c.lon});map.setZoom(13);token=null;};
      adapter.markers=points=>{markers.forEach(m=>m.map=null);markers=points.map((p,i)=>new AdvancedMarkerElement({map,position:{lat:p.lat,lng:p.lon},title:p.title,content:pin(i+1)}));};
      adapter.clearRoute=()=>{line?.setMap(null);line=null;};
      adapter.fit=points=>{if(!points.length)return;const b=new google.maps.LatLngBounds();points.forEach(p=>b.extend({lat:p.lat,lng:p.lon}));map.fitBounds(b,45);};
      adapter.drawRoute=route=>{adapter.clearRoute();line=new google.maps.Polyline({map,path:route.coordinates.map(([lat,lng])=>({lat,lng})),strokeColor:'#315e48',strokeWeight:5});adapter.fit(route.coordinates.map(([lat,lon])=>({lat,lon})));};
      adapter.search=async(query,c)=>{
        token ||= new AutocompleteSessionToken();const [west,south,east,north]=C.cityBounds(c);
        const {suggestions=[]}=await AutocompleteSuggestion.fetchAutocompleteSuggestions({input:query,sessionToken:token,includedRegionCodes:[c.country.toLowerCase()],locationRestriction:{west,south,east,north}});
        return suggestions.filter(s=>s.placePrediction).slice(0,7).map(s=>{const p=s.placePrediction;return {id:p.placeId,title:p.mainText?.toString()||p.text.toString(),subtitle:p.secondaryText?.toString()||c.name,kind:'Google Places',prediction:p};});
      };
      adapter.resolve=async(p,c)=>{const place=p.prediction.toPlace();try{await place.fetchFields({fields:['location','formattedAddress']});return finitePoint(p.id,p.title,place.formattedAddress,[place.location?.lng(),place.location?.lat()],c);}finally{token=null;}};
      adapter.route=async points=>{
        const location=p=>({lat:p.lat,lng:p.lon});
        const {routes}=await Route.computeRoutes({origin:location(points[0]),destination:location(points.at(-1)),intermediates:points.slice(1,-1).map(p=>({location:location(p)})),travelMode:'DRIVING',routingPreference:'TRAFFIC_UNAWARE',optimizeWaypointOrder:false,fields:['path','distanceMeters','durationMillis','legs']});
        return D.googleRoute(routes?.[0]);
      };
    }else if(id==='2gis'){
      await load('https://mapgl.2gis.com/api/js/v1');map=new mapgl.Map(element.id,{key:keys.mapKey,center:[city.lon,city.lat],zoom:13});
      adapter.city=c=>{map.setCenter([c.lon,c.lat]);map.setZoom(13);};
      adapter.markers=points=>{markers.forEach(m=>m.destroy());markers=points.map((p,i)=>{const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34"><circle cx="17" cy="17" r="15" fill="#315e48" stroke="white" stroke-width="2"/><text x="17" y="21" text-anchor="middle" font-family="Arial" font-size="12" fill="white">${i+1}</text></svg>`;return new mapgl.Marker(map,{coordinates:lonLat(p),icon:`data:image/svg+xml,${encodeURIComponent(svg)}`,size:[34,34],anchor:[17,17]});});};
      adapter.clearRoute=()=>{line?.destroy();line=null;};
      adapter.fit=points=>{if(!points.length)return;const [a,b]=extent(points);map.setCenter([(a[0]+b[0])/2,(a[1]+b[1])/2]);const span=Math.max((b[0]-a[0])*Math.cos((a[1]+b[1])/2*Math.PI/180),b[1]-a[1],.004);map.setZoom(Math.min(16,Math.max(5,Math.log2(360/span)-1.7)));};
      adapter.drawRoute=route=>{adapter.clearRoute();line=new mapgl.Polyline(map,{coordinates:route.coordinates.map(([lat,lon])=>[lon,lat]),color:'#315e48',width:5});adapter.fit(route.coordinates.map(([lat,lon])=>({lat,lon})));};
      adapter.search=async(query,c,signal)=>{const url=new URL('https://catalog.api.2gis.com/3.0/suggests');url.search=new URLSearchParams({q:query,location:`${c.lon},${c.lat}`,fields:'items.point,items.address',suggest_type:'route_endpoint',locale:'ru_RU',key:keys.searchKey});return D.gisSearch(await json(url,{signal}),c);};
      adapter.route=async(points,signal)=>{
        const body={points:points.map(p=>({type:'stop',lon:p.lon,lat:p.lat})),transport:'driving',route_mode:'fastest',traffic_mode:'jam',locale:'ru',output:'detailed'};
        const url=keys.routeKey?`https://routing.api.2gis.com/routing/7.0.0/global?key=${encodeURIComponent(keys.routeKey)}`:'/api/2gis/route';
        return D.gisRoute(await json(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal}));
      };
    }else if(id==='yandex'){
      await load(`https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(keys.mapKey)}&lang=ru_RU`);await ymaps3.ready;
      ymaps3.getDefaultConfig().setApikeys({suggest:keys.suggestKey,search:keys.searchKey,router:keys.routeKey});
      map=new ymaps3.YMap(element,{location:{center:[city.lon,city.lat],zoom:13}},[new ymaps3.YMapDefaultSchemeLayer({}),new ymaps3.YMapDefaultFeaturesLayer({})]);
      adapter.city=c=>map.setLocation({center:[c.lon,c.lat],zoom:13});
      adapter.markers=points=>{markers.forEach(m=>map.removeChild(m));markers=points.map((p,i)=>{const m=new ymaps3.YMapMarker({coordinates:lonLat(p)},pin(i+1));map.addChild(m);return m;});};
      adapter.clearRoute=()=>{if(line)map.removeChild(line);line=null;};
      adapter.fit=points=>{if(points.length)map.setLocation({bounds:extent(points),duration:200});};
      adapter.drawRoute=route=>{adapter.clearRoute();line=new ymaps3.YMapFeature({geometry:{type:'LineString',coordinates:route.coordinates.map(([lat,lon])=>[lon,lat])},style:{stroke:[{width:5,color:'#315e48'}]}});map.addChild(line);adapter.fit(route.coordinates.map(([lat,lon])=>({lat,lon})));};
      adapter.search=async(query,c)=>{const result=await ymaps3.suggest({text:query,center:[c.lon,c.lat],types:['house','street'],limit:7});return result.filter(p=>p.uri).map((p,i)=>({id:p.uri||`yandex-${i}`,title:p.title.text,subtitle:p.subtitle?.text||c.name,uri:p.uri,kind:'Яндекс'}));};
      adapter.resolve=async(p,c)=>{const features=await ymaps3.search({uri:p.uri,type:['toponyms'],limit:1});return finitePoint(p.id,p.title,p.subtitle,features[0]?.geometry?.coordinates,c);};
      adapter.route=async points=>{const routes=await ymaps3.route({points:points.map(lonLat),type:'driving',bounds:true});return D.yandexRoute(routes[0]?.toRoute());};
    }else throw new Error('Неизвестный провайдер.');
    return adapter;
  }
  window.MapugaAdapters={create};
})();
