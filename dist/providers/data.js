(function(root, factory) {
  const C = typeof module === 'object' && module.exports ? require('../core.js') : root.MapugaCore;
  const api = factory(C);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MapugaProviderData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(C) {
  const validLonLat = c => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0])<=180 && Math.abs(c[1])<=90;
  function route(coordinates, distance, duration, legs=[]) {
    if (!Array.isArray(coordinates) || coordinates.length<2 || !coordinates.every(validLonLat) || !Number.isFinite(distance) || distance<0 || !Number.isFinite(duration) || duration<0) throw new Error('Провайдер вернул неполный маршрут.');
    return {coordinates:coordinates.map(([lon,lat])=>[lat,lon]),distance,duration,legs,snapped:[]};
  }
  function geoSearch(data, city) {
    if (!Array.isArray(data?.features)) throw new Error('Неожиданный ответ Geoapify.');
    return data.features.map(f=>{
      const p=f.properties||{}; const c=f.geometry?.coordinates;
      return {id:p.place_id||`geo-${c?.join('-')}`,title:p.address_line1||p.formatted||p.name,subtitle:p.address_line2||p.city||city.name,lat:c?.[1],lon:c?.[0],kind:p.housenumber?'Адрес':'Место',country:p.country_code};
    }).filter(p=>C.validPoint(p)&&C.isInCity(p,city)&&(!p.country||String(p.country).toUpperCase()===city.country)).slice(0,7);
  }
  function geoRoute(data, count) {
    const feature=data?.features?.[0], properties=feature?.properties;
    const lines=feature?.geometry?.type==='MultiLineString'?feature.geometry.coordinates:null;
    if (!lines || lines.length!==count-1 || properties?.legs?.length!==count-1) throw new Error('Geoapify не вернул отдельные участки между остановками.');
    const legs=properties.legs.map((leg,i)=>{
      const line=lines[i];
      if (!Array.isArray(line)||line.length<2||!line.every(validLonLat)) throw new Error('Некорректная геометрия Geoapify.');
      const steps=(leg.steps||[]).map((step,index)=>{
        if (!Number.isInteger(step.from_index)||!Number.isInteger(step.to_index)||step.from_index<0||step.to_index<step.from_index||step.to_index>=line.length) throw new Error('Некорректные границы манёвра Geoapify.');
        const instruction=step.instruction||{};
        const raw=instruction.type||'';
        const modifier=/TurnAround/.test(raw)?'uturn':/SharpRight/.test(raw)?'sharp right':/SharpLeft/.test(raw)?'sharp left':/SlightRight/.test(raw)?'slight right':/SlightLeft/.test(raw)?'slight left':/Right/.test(raw)?'right':/Left/.test(raw)?'left':'straight';
        const type=index===0?'depart':/DestinationReached/.test(raw)?'arrive':/Roundabout/.test(raw)?'roundabout':/Stay/.test(raw)?'fork':/Merge/.test(raw)?'merge':/Exit/.test(raw)?'off ramp':/Ferry/.test(raw)?'notification':'turn';
        let coordinates=line.slice(step.from_index,step.to_index+1);
        if(coordinates.length===1)coordinates=[coordinates[0],coordinates[0]];
        return {distance:step.distance,duration:step.time,name:step.name||instruction.streets?.join(', ')||'',instructionText:instruction.text||'',maneuver:{type,modifier,exit:instruction.roundabout_exit,location:line[step.from_index]},geometry:{type:'LineString',coordinates}};
      });
      if (!steps.length) throw new Error('Нет пошаговых инструкций Geoapify.');
      // Some responses omit a zero-length final DestinationReached step.
      if (steps.at(-1).maneuver.type!=='arrive') steps.push({distance:0,duration:0,name:'',maneuver:{type:'arrive',location:line.at(-1)},geometry:{type:'LineString',coordinates:[line.at(-1),line.at(-1)]}});
      return {distance:leg.distance,duration:leg.time,steps};
    });
    return route(lines.flat(),properties.distance,properties.time,legs);
  }
  function gisSearch(data, city) {
    if(data?.meta?.code!==200||!Array.isArray(data.result?.items))throw new Error('2ГИС: проверьте ключ Suggest, продукт и лимиты.');
    return data.result.items.map(p=>({id:`2gis-${p.id}`,title:p.address_name||p.full_address_name||p.name,subtitle:p.name!==p.address_name?p.name||city.name:city.name,lat:p.point?.lat,lon:p.point?.lon,kind:'Место'})).filter(p=>C.validPoint(p)&&C.isInCity(p,city)).slice(0,7);
  }
  function parseWkt(text) {
    const match=String(text||'').match(/^\s*LINESTRING\s*(?:Z\s*)?\(([^()]+)\)\s*$/i);
    if(!match)throw new Error('Неизвестный формат геометрии 2ГИС.');
    const coords=match[1].split(',').map(v=>v.trim().split(/\s+/).slice(0,2).map(Number));
    if(coords.length<2||!coords.every(validLonLat))throw new Error('Некорректный LINESTRING 2ГИС.');
    return coords;
  }
  function gisRoute(data) {
    if(data?.status!=='OK'||!data.result?.length)throw new Error('2ГИС не построил маршрут. Проверьте Routing key, географию и подписку.');
    const r=data.result[0], coordinates=[];
    for(const maneuver of r.maneuvers||[])for(const part of maneuver.outcoming_path?.geometry||[]){
      for(const point of parseWkt(part.selection))if(!coordinates.length||point[0]!==coordinates.at(-1)[0]||point[1]!==coordinates.at(-1)[1])coordinates.push(point);
    }
    return route(coordinates,r.total_distance,r.total_duration);
  }
  function googleRoute(r) {
    if(!r)throw new Error('Google не вернул маршрут.');
    const coordinates=(r.path||[]).map(p=>[typeof p.lng==='function'?p.lng():p.lng,typeof p.lat==='function'?p.lat():p.lat]);
    return route(coordinates,r.distanceMeters,r.durationMillis/1000,(r.legs||[]).map(l=>({distance:l.distanceMeters,duration:l.durationMillis/1000})));
  }
  function yandexRoute(feature) {
    if(feature?.geometry?.type!=='LineString')throw new Error('Яндекс не вернул линию маршрута.');
    return route(feature.geometry.coordinates,feature.properties?.length,feature.properties?.duration);
  }
  return {route,geoSearch,geoRoute,gisSearch,gisRoute,parseWkt,googleRoute,yandexRoute};
});
