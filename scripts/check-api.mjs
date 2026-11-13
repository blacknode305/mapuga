import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const C = require('../dist/core.js');
const N = require('../dist/navigation.js');
const city = C.CITIES[0];
const url = C.photonUrl('https://photon.komoot.io/api/', process.argv[2] || 'Бухар Жырау', city);
const searchResponse = await fetch(url, { signal: AbortSignal.timeout(25000) });
if (!searchResponse.ok) throw new Error(`Photon HTTP ${searchResponse.status}: ${await searchResponse.text()}`);
const data = await searchResponse.json();
const points = C.photonPoints(data, city);
console.log(JSON.stringify({ service: 'Photon', status: searchResponse.status, cors: searchResponse.headers.get('access-control-allow-origin'), points }, null, 2));
const routePoints = [
  { id: 'a', title: 'Проверка A', subtitle: '', lat: 49.806, lon: 73.085 },
  { id: 'b', title: 'Проверка B', subtitle: '', lat: 49.817, lon: 73.099 },
];
const routeResponse = await fetch(C.routeUrl('https://router.project-osrm.org', routePoints), { signal: AbortSignal.timeout(30000) });
if (!routeResponse.ok) throw new Error(`OSRM HTTP ${routeResponse.status}`);
const route = C.parseRoute(await routeResponse.json(), routePoints.length);
const guidance = N.prepare(route, routePoints);
console.log(JSON.stringify({ service: 'OSRM', status: routeResponse.status, cors: routeResponse.headers.get('access-control-allow-origin'), distance: route.distance, duration: route.duration, geometryPoints: route.coordinates.length, navigationEvents: guidance.events.length, turns: guidance.events.slice(0, 4).map(e => e.text) }));
