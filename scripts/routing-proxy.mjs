export function validatedStops(body) {
  if(!body||!Array.isArray(body.points)||body.points.length<2||body.points.length>10)throw new Error('Нужно от 2 до 10 точек.');
  return body.points.map(p=>{
    if(!p||!Number.isFinite(p.lon)||!Number.isFinite(p.lat)||Math.abs(p.lon)>180||Math.abs(p.lat)>90)throw new Error('Некорректные координаты.');
    return {type:'stop',lon:p.lon,lat:p.lat};
  });
}

let recent=[];
export async function handleRoutingProxy(req,res,{port,key=process.env.MAPUGA_2GIS_ROUTING_KEY,fetchImpl=fetch}={}) {
  const reply=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
  if(req.method!=='POST'){reply(405,{error:'Используйте POST.'});return;}
  const origin=req.headers.origin;
  if(origin&&origin!==`http://127.0.0.1:${port}`&&origin!==`http://localhost:${port}`){reply(403,{error:'Разрешён только origin локального приложения.'});return;}
  if(!key){reply(503,{error:'Задайте MAPUGA_2GIS_ROUTING_KEY в окружении Node и перезапустите локальный сервер.'});return;}
  const now=Date.now();recent=recent.filter(t=>now-t<60000);
  if(recent.length>=30){reply(429,{error:'Локальный лимит: 30 маршрутов в минуту.'});return;}
  try{
    let text='';for await(const chunk of req){text+=chunk;if(text.length>16384){reply(413,{error:'Слишком большой запрос.'});return;}}
    let points;try{points=validatedStops(JSON.parse(text));}catch{reply(400,{error:'Нужны 2–10 корректных точек lon/lat.'});return;}
    if(recent.length>=30){reply(429,{error:'Локальный лимит: 30 маршрутов в минуту.'});return;}
    recent.push(now);
    const url=new URL('https://routing.api.2gis.com/routing/7.0.0/global');url.searchParams.set('key',key);
    const upstream=await fetchImpl(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({points,transport:'driving',route_mode:'fastest',traffic_mode:'jam',locale:'ru',output:'detailed'}),signal:AbortSignal.timeout(20000)});
    if(!upstream.ok){reply(upstream.status,{error:'2ГИС отклонил запрос. Проверьте Routing key, подписку и лимиты.'});return;}
    reply(200,await upstream.json());
  }catch{reply(502,{error:'Маршрутизатор не ответил. Ключ и детали запроса не выводятся в журнал.'});}
}
