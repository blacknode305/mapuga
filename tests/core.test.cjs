const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../dist/core.js');
const city = C.CITIES[0];
const point = (id, extra = {}) => ({ id, title: `Адрес ${id}`, subtitle: 'Караганда', lat: 49.806, lon: 73.085, ...extra });

test('Country suggestions match prefixes, ISO codes and local/English alternative names', () => {
  assert.equal(C.findCountries(' рос ')[0].code, 'RU');
  assert.equal(C.findCountries('қаз')[0].code, 'KZ');
  assert.equal(C.findCountries('kyr')[0].code, 'KG');
  assert.equal(C.findCountries('Белорус')[0].code, 'BY');
  assert.equal(C.findCountries('ua')[0].code, 'UA');
  assert.equal(C.findCountries('федера')[0].code, 'RU');
  assert.deepEqual(C.findCountries('нет-такой-страны'), []);
  assert.equal(C.findCountries('stan').length, 5);
});

test('Every selectable country has cities and country suggestions never mutate the registry', () => {
  const before = C.COUNTRIES.map(c => c.code);
  C.findCountries(''); C.findCountries('a');
  assert.deepEqual(C.COUNTRIES.map(c => c.code), before);
  for (const country of C.COUNTRIES) assert.ok(C.CITIES.some(city => city.country === country.code), country.name);
  for (const city of C.CITIES) assert.ok(C.COUNTRIES.some(country => city.country === country.code), city.name);
});

test('Photon search keeps Cyrillic, restricts the area, and uses a supported language', () => {
  const url = new URL(C.photonUrl('https://photon.komoot.io/api/', '  Бухар Жырау 50  ', city));
  assert.equal(url.searchParams.get('q'), 'Бухар Жырау 50');
  assert.equal(url.searchParams.get('lang'), 'default');
  assert.equal(url.searchParams.get('lat'), String(city.lat));
  const [west, south, east, north] = url.searchParams.get('bbox').split(',').map(Number);
  assert.ok(west < city.lon && east > city.lon && south < city.lat && north > city.lat);
});

test('Search rejects foreign, out-of-area and malformed results and deduplicates OSM IDs', () => {
  const feature = (id, properties = {}, coordinates = [73.085, 49.806]) => ({
    geometry: { type: 'Point', coordinates },
    properties: { osm_id: id, osm_type: 'W', countrycode: 'KZ', street: 'Ерубаева', housenumber: '50', city: 'Қарағанды', ...properties },
  });
  const points = C.photonPoints({ features: [
    feature(1), feature(1), feature(2, { countrycode: 'KG' }),
    feature(3, {}, [71.43, 51.12]), feature(4, {}, ['73', null]),
    { properties: {}, geometry: null },
    feature(5, { housenumber: undefined }), feature(6, { city: 'Саран' }),
  ] }, city);
  assert.equal(points.length, 2);
  assert.equal(points[0].title, 'Ерубаева, 50');
  assert.equal(points[0].kind, 'Адрес');
  assert.equal(points[1].kind, 'Улица');
});

test('Route request preserves stop order and sends longitude before latitude', () => {
  const points = [point('a'), point('b', { lat: 49.817, lon: 73.099 })];
  const url = new URL(C.routeUrl('https://router.project-osrm.org/', points));
  assert.equal(url.pathname, '/route/v1/driving/73.085000,49.806000;73.099000,49.817000');
  assert.equal(url.searchParams.get('geometries'), 'geojson');
  assert.equal(url.searchParams.get('steps'), 'true');
  assert.equal(url.searchParams.get('radiuses'), '1500;1500');
  assert.throws(() => C.routeUrl('https://example.com', [points[0]]));
});

test('Route response validates geometry and stops and reverses coordinates only for Leaflet', () => {
  const data = { code: 'Ok', routes: [{ distance: 3383.6, duration: 285.1, geometry: { type: 'LineString', coordinates: [[73.085, 49.806], [73.099, 49.817]] }, legs: [{ distance: 3383.6, duration: 285.1 }] }] };
  assert.deepEqual(C.parseRoute(data, 2).coordinates, [[49.806, 73.085], [49.817, 73.099]]);
  assert.throws(() => C.parseRoute(data, 3), /неполные/);
  assert.throws(() => C.parseRoute({ code: 'NoRoute' }, 2), /дорогой/);
  const invalid = structuredClone(data);
  invalid.routes[0].geometry.coordinates[0][0] = 200;
  assert.throws(() => C.parseRoute(invalid, 2), /неполные/);
  const invalidLeg = structuredClone(data);
  invalidLeg.routes[0].legs[0].distance = null;
  assert.throws(() => C.parseRoute(invalidLeg, 2), /неполные/);
});

test('Reordering can change the start and never mutates the input array', () => {
  const points = [point('a'), point('b'), point('c')];
  assert.deepEqual(C.movePoint(points, 2, 0).map(p => p.id), ['c', 'a', 'b']);
  assert.deepEqual(points.map(p => p.id), ['a', 'b', 'c']);
  assert.deepEqual(C.movePoint(points, 0, -1), points);
});

test('Restoring a plan rejects corrupt data, unknown cities and invalid/outside stops', () => {
  assert.equal(C.restoreState('{broken'), null);
  assert.equal(C.restoreState({ version: 1, cityId: '__proto__', points: [] }), null);
  const restored = C.restoreState(JSON.stringify({ version: 1, cityId: city.id, points: [point('a'), point('a'), point('outside', { lat: 0, lon: 0 }), point('invalid', { lon: '73' }), point('b'), point('c')] }), 2);
  assert.equal(restored.city.id, 'karaganda');
  assert.deepEqual(restored.points.map(p => p.id), ['a', 'b']);
});

test('GPX exports real route coordinates and escapes user-controlled XML text', () => {
  const gpx = C.toGpx([point('a', { title: '<дом> & "офис"' })], { coordinates: [[49.806, 73.085], [49.817, 73.099]] });
  assert.ok(gpx.includes('&lt;дом&gt; &amp; &quot;офис&quot;'));
  assert.ok(gpx.includes('<trkpt lat="49.806" lon="73.085"/>'));
  assert.ok(!gpx.includes('<дом>'));
});

test('Time and distance labels cover short trips and hour boundaries', () => {
  assert.equal(C.formatDistance(870), '870 м');
  assert.equal(C.formatDuration(0), '1 мин');
  assert.equal(C.formatDuration(3600), '1 ч');
  assert.equal(C.formatDuration(3660), '1 ч 1 мин');
});
