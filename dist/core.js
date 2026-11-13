(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MapugaCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const COUNTRIES = [
    { code: 'KZ', name: 'Казахстан', aliases: ['Kazakhstan', 'Qazaqstan', 'Қазақстан', 'Казакстан'] },
    { code: 'KG', name: 'Кыргызстан', aliases: ['Киргизия', 'Kyrgyzstan', 'Kyrgyz Republic'] },
    { code: 'UZ', name: 'Узбекистан', aliases: ['Uzbekistan', 'Oʻzbekiston'] },
    { code: 'RU', name: 'Россия', aliases: ['РФ', 'Российская Федерация', 'Russia', 'Russian Federation'] },
    { code: 'BY', name: 'Беларусь', aliases: ['Белоруссия', 'Belarus'] },
    { code: 'AM', name: 'Армения', aliases: ['Armenia', 'Հայաստան'] },
    { code: 'AZ', name: 'Азербайджан', aliases: ['Azerbaijan', 'Azərbaycan'] },
    { code: 'TJ', name: 'Таджикистан', aliases: ['Tajikistan', 'Тоҷикистон'] },
    { code: 'TM', name: 'Туркменистан', aliases: ['Turkmenistan', 'Türkmenistan'] },
    { code: 'MD', name: 'Молдова', aliases: ['Молдавия', 'Moldova'] },
    { code: 'GE', name: 'Грузия', aliases: ['Georgia', 'საქართველო'] },
    { code: 'UA', name: 'Украина', aliases: ['Ukraine', 'Україна'] },
  ];
  const CITY_ALIASES = {
    karaganda: ['Қарағанды', 'Karaganda', 'Qaragandy'],
    astana: ['Astana', 'Нур-Султан', 'Нұр-Сұлтан', 'Nur-Sultan'],
    almaty: ['Almaty', 'Алма-Ата'], shymkent: ['Shymkent', 'Чимкент'],
    aktobe: ['Ақтөбе', 'Aktobe', 'Aqtobe'], atyrau: ['Atyrau'], aktau: ['Ақтау', 'Aktau', 'Aqtau'],
    pavlodar: ['Pavlodar'], 'ust-kamenogorsk': ['Өскемен', 'Oskemen', 'Ust-Kamenogorsk'],
    semey: ['Semey', 'Семипалатинск'], kostanay: ['Қостанай', 'Kostanay', 'Qostanai'],
    kyzylorda: ['Қызылорда', 'Kyzylorda', 'Qyzylorda'], taraz: ['Taraz'],
    uralsk: ['Орал', 'Oral', 'Uralsk'], petropavlovsk: ['Петропавл', 'Petropavl', 'Petropavlovsk'],
    temirtau: ['Теміртау', 'Temirtau'], kokshetau: ['Көкшетау', 'Kokshetau'],
    turkistan: ['Түркістан', 'Turkistan', 'Turkestan'], bishkek: ['Bishkek'], osh: ['Osh'],
    karakol: ['Karakol'], tashkent: ['Тошкент', 'Toshkent', 'Tashkent'],
    samarkand: ['Самарқанд', 'Samarqand', 'Samarkand'], bukhara: ['Бухоро', 'Buxoro', 'Bukhara'],
    moscow: ['Москва', 'Moscow', 'Moskva'], 'saint-petersburg': ['Санкт-Петербург', 'Saint Petersburg', 'St. Petersburg'],
    kazan: ['Казань', 'Казан', 'Kazan'], novosibirsk: ['Новосибирск', 'Novosibirsk'],
    minsk: ['Минск', 'Мінск', 'Minsk'], brest: ['Брест', 'Брэст', 'Brest'],
    yerevan: ['Ереван', 'Երևան', 'Yerevan'], gyumri: ['Гюмри', 'Գյումրի', 'Gyumri'],
    baku: ['Баку', 'Bakı', 'Baku'], ganja: ['Гянджа', 'Gəncə', 'Ganja'],
    dushanbe: ['Душанбе', 'Dushanbe'], khujand: ['Худжанд', 'Хуҷанд', 'Khujand'],
    ashgabat: ['Ашхабад', 'Aşgabat', 'Ashgabat'], turkmenabat: ['Туркменабад', 'Türkmenabat', 'Turkmenabat'],
    chisinau: ['Кишинёв', 'Кишинев', 'Chișinău', 'Chisinau'], balti: ['Бельцы', 'Bălți', 'Balti'],
    tbilisi: ['Тбилиси', 'თბილისი', 'Tbilisi'], batumi: ['Батуми', 'ბათუმი', 'Batumi'],
    kyiv: ['Киев', 'Київ', 'Kyiv', 'Kiev'], lviv: ['Львов', 'Львів', 'Lviv'],
  };
  const CITIES = [
    ['karaganda', 'Караганда', 'KZ', 49.806, 73.085, 24],
    ['astana', 'Астана', 'KZ', 51.128, 71.431, 28],
    ['almaty', 'Алматы', 'KZ', 43.238, 76.89, 28],
    ['shymkent', 'Шымкент', 'KZ', 42.315, 69.59, 24],
    ['aktobe', 'Актобе', 'KZ', 50.283, 57.167, 22],
    ['atyrau', 'Атырау', 'KZ', 47.106, 51.923, 20],
    ['aktau', 'Актау', 'KZ', 43.653, 51.197, 20],
    ['pavlodar', 'Павлодар', 'KZ', 52.287, 76.967, 22],
    ['ust-kamenogorsk', 'Усть-Каменогорск', 'KZ', 49.948, 82.628, 24],
    ['semey', 'Семей', 'KZ', 50.412, 80.25, 22],
    ['kostanay', 'Костанай', 'KZ', 53.214, 63.624, 20],
    ['kyzylorda', 'Кызылорда', 'KZ', 44.848, 65.498, 22],
    ['taraz', 'Тараз', 'KZ', 42.9, 71.367, 20],
    ['uralsk', 'Уральск', 'KZ', 51.228, 51.387, 20],
    ['petropavlovsk', 'Петропавловск', 'KZ', 54.873, 69.151, 20],
    ['temirtau', 'Темиртау', 'KZ', 50.054, 72.964, 15],
    ['kokshetau', 'Кокшетау', 'KZ', 53.283, 69.389, 18],
    ['turkistan', 'Туркестан', 'KZ', 43.3, 68.268, 18],
    ['bishkek', 'Бишкек', 'KG', 42.875, 74.603, 24],
    ['osh', 'Ош', 'KG', 40.514, 72.816, 18],
    ['karakol', 'Каракол', 'KG', 42.49, 78.393, 14],
    ['tashkent', 'Ташкент', 'UZ', 41.311, 69.279, 30],
    ['samarkand', 'Самарканд', 'UZ', 39.655, 66.959, 22],
    ['bukhara', 'Бухара', 'UZ', 39.768, 64.455, 18],
    ['moscow', 'Москва', 'RU', 55.7558, 37.6173, 40],
    ['saint-petersburg', 'Санкт-Петербург', 'RU', 59.9386, 30.3141, 32],
    ['kazan', 'Казань', 'RU', 55.7961, 49.1064, 24],
    ['novosibirsk', 'Новосибирск', 'RU', 55.0302, 82.9204, 28],
    ['minsk', 'Минск', 'BY', 53.9, 27.5667, 25],
    ['brest', 'Брест', 'BY', 52.0976, 23.7341, 18],
    ['yerevan', 'Ереван', 'AM', 40.1872, 44.5152, 22],
    ['gyumri', 'Гюмри', 'AM', 40.7894, 43.8476, 14],
    ['baku', 'Баку', 'AZ', 40.4093, 49.8671, 30],
    ['ganja', 'Гянджа', 'AZ', 40.6828, 46.3606, 16],
    ['dushanbe', 'Душанбе', 'TJ', 38.5598, 68.787, 20],
    ['khujand', 'Худжанд', 'TJ', 40.2826, 69.6222, 16],
    ['ashgabat', 'Ашхабад', 'TM', 37.9601, 58.3261, 25],
    ['turkmenabat', 'Туркменабад', 'TM', 39.0733, 63.5786, 18],
    ['chisinau', 'Кишинёв', 'MD', 47.0105, 28.8638, 22],
    ['balti', 'Бельцы', 'MD', 47.7617, 27.9289, 14],
    ['tbilisi', 'Тбилиси', 'GE', 41.7151, 44.8271, 25],
    ['batumi', 'Батуми', 'GE', 41.6168, 41.6367, 17],
    ['kyiv', 'Киев', 'UA', 50.4501, 30.5234, 30],
    ['lviv', 'Львов', 'UA', 49.8397, 24.0297, 20],
  ].map(([id, name, country, lat, lon, radius]) => ({ id, name, country, lat, lon, radius }));

  function normalize(value) {
    return String(value || '').toLocaleLowerCase('ru').replace(/ё/g, 'е').trim();
  }

  function findCountries(query) {
    const q = normalize(query);
    const rank = value => {
      const name = normalize(value);
      return !q || name === q ? 0 : name.startsWith(q) ? 1 : name.includes(q) ? 2 : Infinity;
    };
    return COUNTRIES.map(country => ({ country, rank: Math.min(...[country.name, country.code, ...country.aliases].map(rank)) }))
      .filter(match => Number.isFinite(match.rank))
      .sort((a, b) => a.rank - b.rank || a.country.name.localeCompare(b.country.name, 'ru'))
      .map(match => match.country);
  }

  function cityBounds(city) {
    const dy = city.radius / 111.32;
    const dx = city.radius / (111.32 * Math.cos(city.lat * Math.PI / 180));
    return [city.lon - dx, city.lat - dy, city.lon + dx, city.lat + dy];
  }

  function isInCity(point, city) {
    const [west, south, east, north] = cityBounds(city);
    return point.lon >= west && point.lon <= east && point.lat >= south && point.lat <= north;
  }

  function validPoint(point) {
    return !!point && typeof point.id === 'string' && typeof point.title === 'string' && point.title.length > 0 &&
      point.title.length <= 500 && typeof point.subtitle === 'string' && point.subtitle.length <= 1000 &&
      Number.isFinite(point.lat) && Number.isFinite(point.lon) &&
      Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180;
  }

  function matchingCityName(name, city) {
    if (!name) return true;
    const clean = value => normalize(value).replace(/^(город|г\.)\s*/u, '').replace(/\s+(қаласы|шаары|shahri|city)$/u, '');
    return [city.name, ...(CITY_ALIASES[city.id] || [])].some(alias => clean(alias) === clean(name));
  }

  function photonUrl(base, query, city) {
    const url = new URL(base);
    url.search = new URLSearchParams({
      q: query.trim(), lang: 'default', limit: '12',
      lat: String(city.lat), lon: String(city.lon),
      bbox: cityBounds(city).map(n => n.toFixed(5)).join(','),
    });
    // Country codes are also checked on results: older public Photon versions lack countrycode.
    return url.href;
  }

  function photonPoints(data, city) {
    if (!Array.isArray(data?.features)) throw new Error('Сервис поиска вернул неожиданный ответ.');
    const found = new Map();
    for (const feature of data.features) {
      const p = feature?.properties || {};
      const coordinates = feature?.geometry?.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) continue;
      if (p.countrycode && String(p.countrycode).toUpperCase() !== city.country) continue;
      if (!matchingCityName(p.city, city)) continue;
      const address = [p.street, p.housenumber].filter(Boolean).join(', ');
      const title = address || p.name;
      if (!title) continue;
      const point = {
        id: p.osm_id != null ? `${p.osm_type || 'N'}-${p.osm_id}` : `geo-${coordinates[0]}-${coordinates[1]}`,
        title,
        subtitle: [...new Set([p.name !== title && p.name, p.district || p.suburb, p.city || city.name].filter(Boolean))].join(' · '),
        lat: coordinates[1], lon: coordinates[0],
        kind: p.housenumber ? 'Адрес' : p.street || p.osm_key === 'highway' ? 'Улица' : 'Место',
      };
      if (validPoint(point) && isInCity(point, city)) found.set(point.id, point);
    }
    return [...found.values()].slice(0, 7);
  }

  function routeUrl(base, points) {
    if (points.length < 2 || !points.every(validPoint)) throw new Error('Добавьте минимум две корректные точки.');
    const coords = points.map(p => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
    const url = new URL(`${base.replace(/\/$/, '')}/route/v1/driving/${coords}`);
    url.search = new URLSearchParams({ overview: 'full', geometries: 'geojson', steps: 'true', radiuses: points.map(() => '1500').join(';') });
    return url.href;
  }

  function parseRoute(data, count) {
    if (data?.code !== 'Ok' || !data.routes?.length) {
      throw new Error(data?.code === 'NoRoute' || data?.code === 'NoSegment'
        ? 'Не удалось соединить точки автомобильной дорогой. Попробуйте уточнить адрес или выбрать точку ближе к дороге.'
        : 'Сервис маршрутов не смог построить путь. Попробуйте ещё раз.');
    }
    const route = data.routes[0];
    const coords = route.geometry?.coordinates;
    if (route.geometry?.type !== 'LineString' || !Array.isArray(coords) || coords.length < 2 ||
        !coords.every(c => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90) ||
        !Number.isFinite(route.distance) || route.distance < 0 || !Number.isFinite(route.duration) || route.duration < 0 ||
        !Array.isArray(route.legs) || route.legs.length !== count - 1 ||
        !route.legs.every(leg => Number.isFinite(leg.distance) && leg.distance >= 0 && Number.isFinite(leg.duration) && leg.duration >= 0)) {
      throw new Error('Сервис маршрутов вернул неполные данные. Попробуйте ещё раз.');
    }
    return {
      coordinates: coords.map(c => [c[1], c[0]]),
      distance: route.distance, duration: route.duration,
      legs: route.legs,
      snapped: Array.isArray(data.waypoints) ? data.waypoints : [],
    };
  }

  function movePoint(points, from, to) {
    const next = points.slice();
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
    next.splice(to, 0, next.splice(from, 1)[0]);
    return next;
  }

  function restoreState(raw, maxPoints = 20) {
    try {
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!data || data.version !== 1) return null;
      const city = CITIES.find(c => c.id === data.cityId);
      if (!city) return null;
      const points = Array.isArray(data.points)
        ? data.points.filter(p => validPoint(p) && isInCity(p, city)) : [];
      return { city, points: [...new Map(points.map(p => [p.id, p])).values()].slice(0, maxPoints) };
    } catch { return null; }
  }

  function formatDistance(meters) {
    return meters < 1000 ? `${Math.round(meters)} м` : `${(meters / 1000).toLocaleString('ru', { maximumFractionDigits: 1 })} км`;
  }

  function formatDuration(seconds) {
    const minutes = Math.max(1, Math.round(seconds / 60));
    return minutes < 60 ? `${minutes} мин` : `${Math.floor(minutes / 60)} ч${minutes % 60 ? ` ${minutes % 60} мин` : ''}`;
  }

  function escapeXml(text) {
    return String(text).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
  }

  function toGpx(points, route) {
    const waypoints = points.map(p => `  <wpt lat="${p.lat}" lon="${p.lon}"><name>${escapeXml(p.title)}</name></wpt>`).join('\n');
    const track = route.coordinates.map(([lat, lon]) => `      <trkpt lat="${lat}" lon="${lon}"/>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Mapuga" xmlns="http://www.topografix.com/GPX/1/1">\n${waypoints}\n  <trk><name>Маршрут Mapuga</name><trkseg>\n${track}\n  </trkseg></trk>\n</gpx>`;
  }

  return { COUNTRIES, CITIES, normalize, findCountries, cityBounds, isInCity, validPoint, photonUrl, photonPoints, routeUrl, parseRoute, movePoint, restoreState, formatDistance, formatDuration, toGpx };
});
