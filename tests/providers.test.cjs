const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../dist/core.js'),D=require('../dist/providers/data.js'),N=require('../dist/navigation.js'),E=require('../dist/providers/economics.js');

test('Geoapify results stay in the selected city/country and preserve address coordinates',()=>{
  const feature=(country,coords=[73.085,49.806])=>({properties:{place_id:country,address_line1:'Бухар Жырау, 50',address_line2:'Караганда',country_code:country,housenumber:'50'},geometry:{coordinates:coords}});
  const points=D.geoSearch({features:[feature('kz'),feature('kg'),feature('kz',[71.4,51.1])]},C.CITIES[0]);
  assert.equal(points.length,1);assert.equal(points[0].lat,49.806);assert.equal(points[0].lon,73.085);
});

test('Geoapify multi-leg route becomes navigable geometry with localized turn instructions',()=>{
  const a=[73.08,49.8],b=[73.084,49.8],c=[73.084,49.803],d=[73.087,49.803];
  const data={features:[{geometry:{type:'MultiLineString',coordinates:[[a,b,c],[c,d]]},properties:{distance:835,time:180,legs:[
    {distance:620,time:130,steps:[{distance:287,time:60,from_index:0,to_index:1,instruction:{type:'StartAt',text:'Начните движение'}},{distance:333,time:70,from_index:1,to_index:2,instruction:{type:'Left',text:'Поверните налево на Северную'}}]},
    {distance:215,time:50,steps:[{distance:215,time:50,from_index:0,to_index:1,instruction:{type:'StartAt',text:'Начните движение'}}]},
  ]}}]};
  const route=D.geoRoute(data,3);assert.equal(route.legs.length,2);assert.equal(route.coordinates[0][0],49.8);
  const guidance=N.prepare(route,[{title:'A'},{title:'B'},{title:'C'}]);
  assert.equal(guidance.checkpoints.length,2);assert.equal(guidance.events[0].text,'Поверните налево на Северную');
  assert.throws(()=>D.geoRoute(data,2),/участки/);
  const invalid=structuredClone(data);invalid.features[0].properties.legs[0].steps[0].to_index=99;assert.throws(()=>D.geoRoute(invalid,3),/границы/);
});

test('2GIS WKT is parsed longitude-first and consecutive maneuver joints are deduplicated',()=>{
  const route=D.gisRoute({status:'OK',result:[{total_distance:1000,total_duration:120,maneuvers:[{outcoming_path:{geometry:[{selection:'LINESTRING (73.08 49.8, 73.084 49.8)'}]}},{outcoming_path:{geometry:[{selection:'LINESTRING(73.084 49.8,73.084 49.803)'}]}}]}]});
  assert.deepEqual(route.coordinates,[[49.8,73.08],[49.8,73.084],[49.803,73.084]]);
  assert.throws(()=>D.parseWkt('LINESTRING(999 20, 3 4)'),/Некорректный/);
  assert.throws(()=>D.parseWkt('anything'),/формат/);
  assert.throws(()=>D.gisRoute({status:'ERROR'}),/не построил/);
});

test('Google milliseconds and Yandex lon/lat route data are normalized without fabricated metrics',()=>{
  const google=D.googleRoute({path:[{lat:49.8,lng:73.08},{lat:49.81,lng:73.09}],distanceMeters:1500,durationMillis:180000,legs:[{distanceMeters:1500,durationMillis:180000}]});
  assert.equal(google.duration,180);assert.equal(google.legs[0].duration,180);
  const yandex=D.yandexRoute({geometry:{type:'LineString',coordinates:[[73.08,49.8],[73.09,49.81]]},properties:{length:1500,duration:180}});
  assert.deepEqual(yandex.coordinates,google.coordinates);
  assert.throws(()=>D.yandexRoute({geometry:{type:'LineString',coordinates:[[73.08,49.8],[73.09,49.81]]},properties:{}}),/неполный/);
});

test('Ad model uses actual eligible filled impressions and never presents an unknown quote as free',()=>{
  const r=E.calculate({dau:100});assert.equal(r.impressions,4800);assert.ok(Math.abs(r.revenue-3.6)<1e-9);
  assert.equal(r.geoapify.dailyCredits,2500);assert.equal(r.geoapify.apiCost,0);assert.equal(r.geoapify.freeDauCapacity,120);
  assert.equal(r['2gis'].apiCost,null);assert.equal(r['2gis'].net,null);assert.equal(r.yandex.net,null);assert.equal(r.osm.net,null);
  assert.equal(E.calculate({eligibleShare:0}).revenue,0);assert.equal(E.calculate({fill:0}).geoapify.breakEvenEcpm,null);
});

test('Google free caps and graduated pricing are independent across map, search, details and routes',()=>{
  assert.equal(E.cost(10000,'maps'),0);assert.equal(E.cost(11000,'maps'),7);
  assert.equal(E.cost(120000,'details'),530);
  const r=E.calculate({dau:1000});assert.ok(Math.abs(r.google.apiCost-1614.9)<1e-8);
  const native=E.calculate({dau:1000,googleNative:true});assert.equal(native.google.items.maps,0);assert.ok(native.google.apiCost>1000);
  assert.equal(E.calculate({points:11}).google.apiCost,null);
  assert.throws(()=>E.calculate({fill:1.5}),/Доли/);
});

test('Geoapify is a daily tier, not a free monthly pool or fractional overage charge',()=>{
  assert.equal(E.calculate({dau:120}).geoapify.apiCost,0);
  assert.equal(E.calculate({dau:121}).geoapify.apiCost,59);
  assert.equal(E.calculate({dau:400}).geoapify.apiCost,59);
  assert.equal(E.calculate({dau:401}).geoapify.apiCost,109);
  assert.equal(E.calculate({dau:1000}).geoapify.apiCost,109);
  assert.equal(E.calculate({dau:10000}).geoapify.apiCost,609);
  assert.equal(E.calculate({dau:10001}).geoapify.apiCost,null);
});
