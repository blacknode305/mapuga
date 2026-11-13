(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MapugaFleet=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const copy=value=>JSON.parse(JSON.stringify(value));
  const uid=prefix=>`${prefix}-${typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)}`;
  const text=(value,max=100)=>typeof value==='string'?value.trim().slice(0,max):'';
  const coordinate=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180;
  const meters=(a,b)=>{const rad=Math.PI/180,dy=(b[0]-a[0])*rad,dx=(b[1]-a[1])*rad;const h=Math.sin(dy/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dx/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));};
  function pathIndex(coordinates){const cumulative=[0];for(let i=1;i<coordinates.length;i++)cumulative.push(cumulative[i-1]+meters(coordinates[i-1],coordinates[i]));return cumulative;}
  function position(trip,now=Date.now()){
    const elapsed=trip.state==='moving'?Math.max(0,now-trip.startedAt)/1000*trip.speed:0;
    const progress=Math.min(1,Math.max(0,trip.progress+elapsed/trip.duration));
    const cumulative=pathIndex(trip.coordinates),total=cumulative.at(-1),distance=total*progress;
    let index=1;while(index<cumulative.length-1&&cumulative[index]<distance)index++;
    const ratio=cumulative[index]===cumulative[index-1]?0:(distance-cumulative[index-1])/(cumulative[index]-cumulative[index-1]);
    const a=trip.coordinates[index-1],b=trip.coordinates[index];
    return {lat:a[0]+(b[0]-a[0])*ratio,lon:a[1]+(b[1]-a[1])*ratio,progress,remaining:Math.max(0,trip.duration*(1-progress)),state:progress>=1?'arrived':trip.state};
  }
  function organization(state,id){return state.organizations.find(o=>o.id===id);}
  function supplier(state,id){const org=organization(state,id);if(!org||org.kind!=='supplier')throw new Error('Действие доступно поставщику.');return org;}
  function ownedTrip(state,actor,id){supplier(state,actor);const trip=state.trips.find(t=>t.id===id&&t.ownerId===actor);if(!trip)throw new Error('Рейс не принадлежит выбранной организации.');return trip;}
  function register(state,{name,kind}){
    name=text(name,70);if(name.length<2||!['supplier','recipient'].includes(kind))throw new Error('Введите название и выберите тип организации.');
    if(state.organizations.some(o=>o.name.toLocaleLowerCase()===name.toLocaleLowerCase()))throw new Error('Такая организация уже есть в демо.');
    const org={id:uid('org'),name,kind};state.organizations.push(org);return org;
  }
  function addVehicle(state,actor,{plate,label}){
    supplier(state,actor);plate=text(plate,24).toUpperCase();label=text(label,50);
    if(!plate||!label)throw new Error('Введите номер и название машины.');
    if(state.vehicles.some(v=>v.ownerId===actor&&v.plate===plate))throw new Error('Машина с таким номером уже добавлена.');
    const vehicle={id:uid('vehicle'),ownerId:actor,plate,label};state.vehicles.push(vehicle);return vehicle;
  }
  function validGrants(state,ids){return [...new Set(ids)].filter(id=>organization(state,id)?.kind==='recipient');}
  function assign(state,actor,{vehicleId,title,stops,coordinates,duration,distance,grants},now=Date.now()){
    supplier(state,actor);const vehicle=state.vehicles.find(v=>v.id===vehicleId&&v.ownerId===actor);if(!vehicle)throw new Error('Выберите машину своей организации.');
    if(state.trips.some(t=>t.vehicleId===vehicleId&&['moving','paused','ready'].includes(position(t,now).state)))throw new Error('У машины уже есть незавершённый рейс. Сначала завершите его.');
    title=text(title,90);if(!title||!Array.isArray(stops)||stops.length<2||stops.length>10||!stops.every(s=>text(s.title)&&coordinate([s.lat,s.lon])))throw new Error('Нужны название рейса и от 2 до 10 адресов.');
    if(!Array.isArray(coordinates)||coordinates.length<2||coordinates.length>30000||!coordinates.every(coordinate)||!Number.isFinite(duration)||duration<=0||!Number.isFinite(distance)||distance<0)throw new Error('Сервис не вернул корректный маршрут.');
    const trip={id:uid('trip'),ownerId:actor,vehicleId,title,stops:copy(stops),coordinates:copy(coordinates),duration,distance,grants:validGrants(state,grants||[]),state:'ready',progress:0,startedAt:0,speed:10};
    state.trips.push(trip);return trip;
  }
  function setAccess(state,actor,id,grants){const trip=ownedTrip(state,actor,id);trip.grants=validGrants(state,grants);return trip;}
  function control(state,actor,id,action,now=Date.now()){
    const trip=ownedTrip(state,actor,id),current=position(trip,now);
    if(['start','reset'].includes(action)&&state.trips.some(t=>t.id!==id&&t.vehicleId===trip.vehicleId&&position(t,now).state!=='arrived'))throw new Error('У этой машины уже есть другой незавершённый рейс.');
    if(action==='start'){if(current.progress>=1)throw new Error('Рейс завершён. Для повторения нажмите «Сначала».');trip.progress=current.progress;trip.startedAt=now;trip.state='moving';}
    else if(action==='pause'){trip.progress=current.progress;trip.startedAt=0;trip.state=current.progress>=1?'arrived':'paused';}
    else if(action==='reset'){trip.progress=0;trip.startedAt=0;trip.state='ready';}
    else if(action==='finish'){trip.progress=1;trip.startedAt=0;trip.state='arrived';}
    else throw new Error('Неизвестное действие.');return trip;
  }
  function visibleTrips(state,actor){const org=organization(state,actor);if(!org)return [];return state.trips.filter(t=>org.kind==='supplier'?t.ownerId===actor:t.grants.includes(actor));}
  function demo(){
    const organizations=[{id:'saryarka',name:'Сарыарка Логистика',kind:'supplier'},{id:'fresh',name:'Fresh Cargo',kind:'supplier'},{id:'market',name:'Маркет у дома',kind:'recipient'},{id:'warehouse',name:'Склад Центральный',kind:'recipient'}];
    const vehicles=[{id:'van-a',ownerId:'saryarka',plate:'DEMO-101',label:'Газель · продукты'},{id:'van-b',ownerId:'saryarka',plate:'DEMO-102',label:'Фургон · бакалея'},{id:'van-c',ownerId:'fresh',plate:'DEMO-201',label:'Рефрижератор'}];
    const paths=[[[49.797,73.08],[49.8005,73.0805],[49.803,73.084],[49.806,73.086],[49.809,73.09],[49.812,73.096]],[[49.824,73.101],[49.822,73.096],[49.818,73.093],[49.814,73.089],[49.811,73.086],[49.807,73.083]],[[49.787,73.095],[49.792,73.096],[49.797,73.096],[49.802,73.096],[49.807,73.096],[49.812,73.096]]];
    const titles=['Утренняя поставка продуктов','Доставка на центральный склад','Охлаждённая продукция'];
    const trips=paths.map((coordinates,i)=>({id:`demo-trip-${i+1}`,ownerId:i===2?'fresh':'saryarka',vehicleId:vehicles[i].id,title:titles[i],stops:[{id:`depot-${i}`,title:`Демо-база №${i+1}`,lat:coordinates[0][0],lon:coordinates[0][1]},{id:`destination-${i}`,title:i===1?'Демо: Центральный склад':'Демо: Маркет у дома',lat:coordinates.at(-1)[0],lon:coordinates.at(-1)[1]}],coordinates,distance:pathIndex(coordinates).at(-1),duration:600,grants:i===1?['warehouse']:['market'],state:'ready',progress:0,startedAt:0,speed:10,illustrative:true}));
    return {version:1,organizations,vehicles,trips};
  }
  function restore(raw){try{
    const state=typeof raw==='string'?JSON.parse(raw):copy(raw);
    if(!state||state.version!==1||!Array.isArray(state.organizations)||!state.organizations.length||state.organizations.length>100||!Array.isArray(state.vehicles)||state.vehicles.length>500||!Array.isArray(state.trips)||state.trips.length>1000)throw 0;
    const ids=new Set();for(const org of state.organizations){if(!text(org.id)||ids.has(org.id)||!text(org.name)||!['supplier','recipient'].includes(org.kind))throw 0;ids.add(org.id);}
    const vehicles=new Set();for(const v of state.vehicles){if(!text(v.id)||vehicles.has(v.id)||organization(state,v.ownerId)?.kind!=='supplier'||!text(v.plate)||!text(v.label))throw 0;vehicles.add(v.id);}
    const tripIds=new Set();for(const t of state.trips){if(!text(t.id)||tripIds.has(t.id)||!text(t.title)||!state.vehicles.some(v=>v.id===t.vehicleId&&v.ownerId===t.ownerId)||!Array.isArray(t.grants)||t.grants.length!==validGrants(state,t.grants).length||!Array.isArray(t.stops)||t.stops.length<2||t.stops.length>10||!t.stops.every(s=>text(s.title)&&coordinate([s.lat,s.lon]))||!Array.isArray(t.coordinates)||t.coordinates.length<2||t.coordinates.length>30000||!t.coordinates.every(coordinate)||!Number.isFinite(t.duration)||t.duration<=0||!Number.isFinite(t.distance)||t.distance<0||!Number.isFinite(t.progress)||t.progress<0||t.progress>1||!Number.isFinite(t.startedAt)||t.startedAt<0||!Number.isFinite(t.speed)||t.speed<1||t.speed>20||!['ready','moving','paused','arrived'].includes(t.state))throw 0;tripIds.add(t.id);}
    return state;
  }catch{return null;}}
  return {demo,restore,register,addVehicle,assign,setAccess,control,visibleTrips,position,pathIndex,organization};
});
