const test=require('node:test');
const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
function request(body,extra={}){const req=Readable.from([JSON.stringify(body)]);req.method='POST';req.headers={origin:'http://localhost:4173'};Object.assign(req,extra);return req;}
function response(){return {status:0,headers:{},body:'',writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=body;}};}

test('Local proxy rejects foreign origins and missing key without any upstream request',async()=>{
  const {handleRoutingProxy}=await import('../scripts/routing-proxy.mjs');let called=0;
  const fetchImpl=async()=>{called++;throw new Error('Should not run');};
  const res=response();await handleRoutingProxy(request({}, {headers:{origin:'https://foreign.example'}}),res,{port:4173,key:'test-only-secret',fetchImpl});assert.equal(res.status,403);
  const missing=response();await handleRoutingProxy(request({}),missing,{port:4173,key:'',fetchImpl});assert.equal(missing.status,503);assert.equal(called,0);
});

test('Proxy only forwards validated stops to the fixed 2GIS endpoint and never returns its key',async()=>{
  const {handleRoutingProxy,validatedStops}=await import('../scripts/routing-proxy.mjs');
  assert.throws(()=>validatedStops({points:[{lon:'73',lat:49}]}));
  assert.throws(()=>validatedStops({points:Array.from({length:11},()=>({lon:73,lat:49}))}));
  const body={points:[{lon:73.08,lat:49.8},{lon:73.09,lat:49.81}],url:'https://foreign.example',transport:'plane'};
  let upstream;const res=response();await handleRoutingProxy(request(body),res,{port:4173,key:'test-only-secret',fetchImpl:async(url,options)=>{upstream={url,options};return {ok:true,json:async()=>({status:'OK',result:[]})};}});
  assert.equal(upstream.url.hostname,'routing.api.2gis.com');assert.equal(upstream.url.searchParams.get('key'),'test-only-secret');
  const sent=JSON.parse(upstream.options.body);assert.equal(sent.transport,'driving');assert.equal(sent.url,undefined);assert.equal(sent.points.length,2);
  assert.equal(res.status,200);assert.ok(!res.body.includes('test-only-secret'));
});
