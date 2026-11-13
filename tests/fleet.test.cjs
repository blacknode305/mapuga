const test=require('node:test');const assert=require('node:assert/strict');const F=require('../dist/fleet-core.js');
test('Recipient sees multiple suppliers only through explicit trip grants; revocation is immediate',()=>{
  const state=F.demo();assert.deepEqual(F.visibleTrips(state,'saryarka').map(t=>t.vehicleId),['van-a','van-b']);assert.deepEqual(F.visibleTrips(state,'market').map(t=>t.vehicleId),['van-a','van-c']);
  F.setAccess(state,'saryarka','demo-trip-1',[]);assert.deepEqual(F.visibleTrips(state,'market').map(t=>t.vehicleId),['van-c']);assert.equal(F.visibleTrips(state,'unknown').length,0);
  assert.throws(()=>F.setAccess(state,'fresh','demo-trip-1',['market']),/не принадлежит/);assert.throws(()=>F.control(state,'market','demo-trip-1','start'),/поставщику/);
});
test('Shared-clock simulation interpolates by distance, pauses without drift, and finishes at endpoint',()=>{
  const state=F.demo(),trip=state.trips[0];F.control(state,'saryarka',trip.id,'start',10000);assert.equal(F.position(trip,40000).progress,.5);F.control(state,'saryarka',trip.id,'pause',40000);assert.equal(F.position(trip,999999).progress,.5);
  F.control(state,'saryarka',trip.id,'start',100000);const end=F.position(trip,1000000);assert.equal(end.state,'arrived');assert.equal(end.lat,trip.coordinates.at(-1)[0]);assert.equal(end.lon,trip.coordinates.at(-1)[1]);assert.throws(()=>F.control(state,'saryarka',trip.id,'start',1000000),/завершён/);
  F.control(state,'saryarka',trip.id,'reset',1000000);assert.equal(F.position(trip).progress,0);
});
test('Organization registration and trip assignment preserve vehicle ownership and one unfinished trip per vehicle',()=>{
  const state=F.demo(),org=F.register(state,{name:'Тестовый поставщик',kind:'supplier'}),van=F.addVehicle(state,org.id,{plate:'demo-new',label:'Фургон'}),base=state.trips[0];
  const input={vehicleId:van.id,title:'Новая доставка',stops:base.stops,coordinates:base.coordinates,duration:180,distance:1000,grants:['market','market','saryarka','absent']};const trip=F.assign(state,org.id,input);assert.deepEqual(trip.grants,['market']);assert.equal(F.restore(JSON.stringify(state)).trips.length,4);
  assert.throws(()=>F.assign(state,org.id,input),/незавершённый/);assert.throws(()=>F.assign(state,'fresh',input),/своей организации/);F.control(state,org.id,trip.id,'finish');assert.doesNotThrow(()=>F.assign(state,org.id,input));assert.throws(()=>F.control(state,org.id,trip.id,'reset'),/другой незавершённый/);assert.throws(()=>F.register(state,{name:'Тестовый поставщик',kind:'supplier'}),/уже есть/);
});
test('Malformed persisted fleet states fail closed instead of exposing corrupted or foreign trips',()=>{
  const state=F.demo();assert.ok(F.restore(state));state.trips[0].grants.push('absent');assert.equal(F.restore(state),null);const other=F.demo();other.trips[0].coordinates[0][0]=999;assert.equal(F.restore(other),null);assert.equal(F.restore('{invalid'),null);
});
