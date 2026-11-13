const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const C=require('../dist/core.js'),D=require('../dist/providers/data.js');
const source=fs.readFileSync(require('node:path').join(__dirname,'../dist/providers/adapters.js'),'utf8');
function runtime(extra={}){
  const loaded=[];const context={MapugaCore:C,MapugaProviderData:D,URL,URLSearchParams,AbortController,DOMException,setTimeout,clearTimeout,queueMicrotask,...extra};context.window=context;
  context.document={createElement(){return {};},head:{append(script){loaded.push(script.src);queueMicrotask(()=>{script.onload();const callback=new URL(script.src).searchParams.get('callback');if(callback)context[callback]();});}}};
  vm.createContext(context);vm.runInContext(source,context);return {context,loaded};
}
const stops=[{id:'a',title:'A',subtitle:'',lat:49.806,lon:73.085},{id:'b',title:'B',subtitle:'',lat:49.81,lon:73.09},{id:'c',title:'C',subtitle:'',lat:49.815,lon:73.095}];
const plain=value=>JSON.parse(JSON.stringify(value));

test('Google uses current libraries, a token per chosen-place session, and only Essentials detail fields',async()=>{
  const requests=[],details=[],routes=[];let sequence=0;
  const place={location:{lat:()=>49.806,lng:()=>73.085},formattedAddress:'Караганда',fetchFields:async r=>details.push(r)};
  const prediction={placeId:'g-1',mainText:{toString:()=> 'Бухар Жырау, 50'},text:{toString:()=> 'Бухар Жырау, 50'},toPlace:()=>place};
  class MockMap{constructor(){}setCenter(){}setZoom(){}fitBounds(){}}
  const libs={maps:{Map:MockMap},marker:{AdvancedMarkerElement:class{}},places:{AutocompleteSessionToken:class{constructor(){this.number=++sequence;}},AutocompleteSuggestion:{fetchAutocompleteSuggestions:async request=>{requests.push(request);return {suggestions:[{placePrediction:prediction}]};}}},routes:{Route:{computeRoutes:async request=>{routes.push(request);return {routes:[{path:[{lat:49.806,lng:73.085},{lat:49.815,lng:73.095}],distanceMeters:1000,durationMillis:120000,legs:[]}]};}}}};
  const {context,loaded}=runtime({google:{maps:{importLibrary:async name=>libs[name]}}});
  const adapter=await context.MapugaAdapters.create('google',{apiKey:'test-browser-key'}, {id:'map'},C.CITIES[0],()=>{});
  assert.ok(loaded[0].includes('callback=__mapugaGoogleReady'));
  const suggestions=await adapter.search('Бухар',C.CITIES[0]);await adapter.search('Бухар 50',C.CITIES[0]);
  assert.equal(details.length,0);assert.equal(requests[0].sessionToken,requests[1].sessionToken);
  await adapter.resolve(suggestions[0],C.CITIES[0]);assert.deepEqual(plain(details[0].fields),['location','formattedAddress']);
  await adapter.search('Гоголя',C.CITIES[0]);assert.notEqual(requests[2].sessionToken,requests[1].sessionToken);
  const route=await adapter.route(stops);assert.equal(route.duration,120);assert.equal(routes[0].routingPreference,'TRAFFIC_UNAWARE');
  assert.deepEqual(plain(routes[0].intermediates),[{location:{lat:49.81,lng:73.09}}]);
});

test('Yandex v3 registers router key, resolves only the selected URI and keeps SDK lon/lat ordering',async()=>{
  let apiKeys,searches=0,routeRequest;
  class MockMap{setLocation(){}addChild(){}removeChild(){}}
  const ymaps3={ready:Promise.resolve(),getDefaultConfig:()=>({setApikeys:keys=>apiKeys=keys}),YMap:MockMap,YMapDefaultSchemeLayer:class{},YMapDefaultFeaturesLayer:class{},
    suggest:async()=>[{uri:'ymaps:uri',title:{text:'Адрес'},subtitle:{text:'Караганда'}}],
    search:async request=>{searches++;assert.equal(request.uri,'ymaps:uri');return [{geometry:{coordinates:[73.085,49.806]}}];},
    route:async request=>{routeRequest=request;return [{toRoute:()=>({geometry:{type:'LineString',coordinates:[[73.085,49.806],[73.095,49.815]]},properties:{length:1000,duration:120}})}];}};
  const {context}=runtime({ymaps3});const adapter=await context.MapugaAdapters.create('yandex',{mapKey:'map-test',suggestKey:'suggest-test',searchKey:'search-test',routeKey:'router-test'},{id:'map'},C.CITIES[0],()=>{});
  assert.equal(apiKeys.router,'router-test');assert.equal(apiKeys.route,undefined);
  const found=await adapter.search('Бухар',C.CITIES[0]);assert.equal(searches,0);const point=await adapter.resolve(found[0],C.CITIES[0]);assert.equal(point.lon,73.085);assert.equal(searches,1);
  await adapter.route(stops);assert.deepEqual(plain(routeRequest.points[0]),[73.085,49.806]);
});

test('2GIS uses route_endpoint suggestions and the local proxy when no browser routing key is supplied',async()=>{
  const requests=[];
  const {context}=runtime({mapgl:{Map:class{}},fetch:async(url,options={})=>{
    const u=new URL(url,'http://localhost:4173');requests.push({url:u,options});
    return {ok:true,json:async()=>u.pathname.includes('suggests')?{meta:{code:200},result:{items:[{id:'1',name:'Магазин',address_name:'Бухар Жырау, 50',point:{lon:73.085,lat:49.806}}]}}:{status:'OK',result:[{total_distance:1000,total_duration:120,maneuvers:[{outcoming_path:{geometry:[{selection:'LINESTRING(73.085 49.806,73.095 49.815)'}]}}]}]}};
  }});
  const adapter=await context.MapugaAdapters.create('2gis',{mapKey:'map-test',searchKey:'search-test',routeKey:''},{id:'map'},C.CITIES[0],()=>{});
  const found=await adapter.search('Бухар',C.CITIES[0]);assert.equal(found[0].lat,49.806);assert.equal(requests[0].url.searchParams.get('suggest_type'),'route_endpoint');
  const route=await adapter.route(stops);assert.equal(route.duration,120);assert.equal(requests[1].url.pathname,'/api/2gis/route');assert.equal(requests[1].url.searchParams.has('key'),false);
  const body=JSON.parse(requests[1].options.body);assert.equal(body.points[0].lon,73.085);assert.equal(body.transport,'driving');
});
