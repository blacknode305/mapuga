(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MapugaEconomics=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const defaults={dau:100,days:30,adsPerDau:2,fill:.8,eligibleShare:1,ecpm:.75,sessions:1,routes:1,points:4,newAddressShare:1,queriesPerAddress:3,abandonedQueriesPerDau:0,tilesPerSession:40,infra:0,googleNative:false,googleNavigation:false,gisQuote:null,yandexQuote:null};
  const limits=[100000,500000,1000000,5000000,Infinity];
  const rates={maps:[7,5.6,4.2,2.1,.53],autocomplete:[2.83,2.27,1.7,.85,.21],details:[5,4,3,1.5,.38],routes:[5,4,3,1.5,.38],navigation:[25,20,15,8,2]};
  const geoPlans=[[3000,0,'Free'],[10000,59,'API 10'],[25000,109,'API 25'],[50000,179,'API 50'],[100000,299,'API 100'],[250000,609,'API 250']];
  function cost(events,type){
    if(!Number.isFinite(events)||events<0||!rates[type])throw new Error('Некорректный объём или SKU.');
    const free=type==='navigation'?1000:10000;
    let total=0,lower=free;
    for(let i=0;i<limits.length;i++){
      const count=Math.max(0,Math.min(events,limits[i])-lower);
      total+=count*rates[type][i]/1000;
      lower=limits[i];
      if(events<=lower)break;
    }
    return total;
  }
  function calculate(input={}){
    const s={...defaults,...input};
    for(const key of ['dau','adsPerDau','sessions','routes','queriesPerAddress','abandonedQueriesPerDau','tilesPerSession','infra','ecpm'])if(!Number.isFinite(s[key])||s[key]<0)throw new Error(`Некорректное значение ${key}`);
    if(!Number.isFinite(s.days)||s.days<1||s.days>31||!Number.isInteger(s.points)||s.points<2||s.points>20||!Number.isInteger(s.queriesPerAddress))throw new Error('Проверьте дни, точки и число запросов.');
    for(const key of ['fill','eligibleShare','newAddressShare'])if(!Number.isFinite(s[key])||s[key]<0||s[key]>1)throw new Error('Доли должны быть от 0 до 1.');
    const monthlyUsers=s.dau*s.days,routeCalls=monthlyUsers*s.routes;
    const addresses=routeCalls*s.points*s.newAddressShare;
    const autocomplete=addresses*Math.min(12,s.queriesPerAddress)+monthlyUsers*s.abandonedQueriesPerDau;
    const impressions=monthlyUsers*s.adsPerDau*s.fill*s.eligibleShare;
    const revenue=impressions/1000*s.ecpm;
    const googleItems={maps:s.googleNative?0:cost(monthlyUsers*s.sessions,'maps'),autocomplete:cost(autocomplete,'autocomplete'),details:cost(addresses,'details'),routes:cost(routeCalls,'routes'),navigation:s.googleNavigation?cost(routeCalls,'navigation'):0};
    const googleCost=Object.values(googleItems).reduce((a,b)=>a+b,0);
    const dailyCredits=s.dau*(s.sessions*s.tilesPerSession*.25+s.routes*(s.points-1)+s.routes*s.points*s.newAddressShare*s.queriesPerAddress+s.abandonedQueriesPerDau);
    const plan=geoPlans.find(([cap])=>dailyCredits<=cap);
    function result(apiCost,extra={}){return {apiCost,net:apiCost===null?null:revenue-apiCost-s.infra,breakEvenEcpm:impressions===0?null:(apiCost===null?null:(apiCost+s.infra)*1000/impressions),...extra};}
    function quote(value){return value===null||value===''||value===undefined?null:Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;}
    return {assumptions:s,impressions,revenue,routeCalls,addresses,autocomplete,mapLoads:monthlyUsers*s.sessions,
      google:result(s.points>10?null:googleCost,{items:googleItems,note:s.points>10?'Лабораторный Google-вариант ограничен 10 точками. Расширенный маршрут требует отдельного SKU.':''}),
      geoapify:result(plan?plan[1]:null,{dailyCredits,plan:plan?.[2]||'Нужен отдельный тариф',freeDauCapacity:s.dau&&dailyCredits?Math.floor(3000/(dailyCredits/s.dau)):null}),
      '2gis':result(quote(s.gisQuote),{minimumRub:21700,note:'Нижняя планка пакетов, не цена любой нагрузки; нужен полный тариф и права на сценарий.'}),
      yandex:result(quote(s.yandexQuote),{minimumRub:20800,note:'Только нижняя планка Router/месяц; остальные продукты и лицензия навигатора отдельно.'}),
      osm:result(null,{note:'Публичный некоммерческий demo не является бесплатной production-инфраструктурой с рекламой.'}),
    };
  }
  return {defaults,rates,geoPlans,cost,calculate};
});
