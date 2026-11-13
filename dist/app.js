(() => {
  'use strict';
  const C = window.MapugaCore;
  const N = window.MapugaNavigation;
  const config = window.MAPUGA_CONFIG;
  const $ = id => document.getElementById(id);
  const storageKey = 'mapuga.plan.v1';
  let restored = null;
  let storageAvailable = true;
  try { restored = C.restoreState(localStorage.getItem(storageKey), config.maxPoints); } catch { storageAvailable = false; }
  const state = { city: restored?.city || C.CITIES[0], points: restored?.points || [], route: null, loading: false, picking: false };
  let map, tiles, markers, routeLine, routeOutline, locationMarker;
  let accuracyCircle, navigationPlan = null, navigation = null, followPosition = true, latestFix = null;
  let routeController, searchController, searchTimer, searchGeneration = 0, routeGeneration = 0;
  let suggestions = [], activeSuggestion = -1, activeCity = -1, activeCountry = -1;
  let lastSearchAt = 0, lastRouteAt = 0;
  let toastTimer, undoAction;
  let tileErrors = 0, tilesLoaded = 0;
  const cache = new Map();

  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('icon');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(svg.namespaceURI, 'use');
    use.setAttribute('href', `#i-${name}`);
    svg.append(use);
    return svg;
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function toast(message, undo) {
    clearTimeout(toastTimer);
    $('toast-text').textContent = message;
    undoAction = undo;
    $('undo-button').hidden = !undo;
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; undoAction = null; }, undo ? 10000 : 6500);
  }

  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, cityId: state.city.id, points: state.points }));
      storageAvailable = true;
    } catch {
      if (storageAvailable) toast('Браузер не разрешил сохранить список. Не закрывайте вкладку.');
      storageAvailable = false;
    }
  }

  function resetSearch(clear = true) {
    searchGeneration++;
    clearTimeout(searchTimer);
    searchController?.abort();
    suggestions = [];
    activeSuggestion = -1;
    $('suggestions').replaceChildren();
    $('suggestions-panel').hidden = true;
    $('address').setAttribute('aria-expanded', 'false');
    $('address').removeAttribute('aria-activedescendant');
    $('search-spinner').hidden = true;
    if (clear) $('address').value = '';
  }

  function invalidateRoute() {
    stopNavigation();
    navigationPlan = null;
    renderNavigationControls();
    routeGeneration++;
    routeController?.abort();
    state.route = null;
    state.loading = false;
    if (routeLine) { routeLine.remove(); routeLine = null; }
    if (routeOutline) { routeOutline.remove(); routeOutline = null; }
    $('route-details').hidden = true;
    $('map-summary').hidden = true;
    $('route-error').hidden = true;
  }

  function updatePlan() {
    // An older undo must not overwrite stops added or reordered afterward.
    clearTimeout(toastTimer);
    $('toast').hidden = true;
    undoAction = null;
    invalidateRoute();
    persist();
    renderPoints();
  }

  function countLabel(count) {
    if (count === 0) return '0 остановок';
    const last = count % 10, lastTwo = count % 100;
    const word = lastTwo >= 11 && lastTwo <= 14 ? 'точек' : last === 1 ? 'точка' : last >= 2 && last <= 4 ? 'точки' : 'точек';
    return `${count} ${word} из ${config.maxPoints}`;
  }

  function renderBuild() {
    $('build-button').disabled = state.points.length < 2 || state.loading || !!state.route;
    $('build-button').setAttribute('aria-busy', String(state.loading));
    $('build-label').textContent = state.loading ? 'Ищем дорогу…' : state.route ? 'Маршрут построен' : 'Построить маршрут';
    $('footer-hint').textContent = state.loading ? 'Прокладываем путь по автомобильным дорогам' : state.route ? 'Измените адреса, чтобы построить новый маршрут' : state.points.length < 2 ? 'Добавьте начальную точку и хотя бы один адрес' : 'По дорогам, в выбранном вами порядке';
  }

  function renderPoints() {
    const list = $('stops-list');
    list.replaceChildren();
    state.points.forEach((point, index) => {
      const li = element('li', 'stop');
      li.append(element('span', 'stop-number', index + 1));
      const content = element('button', 'stop-content');
      content.type = 'button';
      content.title = 'Показать точку на карте';
      content.append(element('span', 'stop-role', index === 0 ? 'НАЧАЛЬНАЯ ТОЧКА' : index === state.points.length - 1 ? 'ФИНИШ' : `ОСТАНОВКА ${index}`));
      content.append(element('strong', 'stop-title', point.title));
      content.append(element('span', 'stop-subtitle', point.subtitle));
      content.addEventListener('click', () => {
        map?.flyTo([point.lat, point.lon], Math.max(map.getZoom(), 16), { duration: .5 });
        if (matchMedia('(max-width:760px)').matches) $('map').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      li.append(content);
      const actions = element('div', 'stop-actions');
      const moves = element('div', 'stop-move');
      for (const [direction, delta, name] of [['up', -1, 'Выше'], ['move-down', 1, 'Ниже']]) {
        const button = element('button');
        button.append(icon(direction));
        button.setAttribute('aria-label', `${name}: ${point.title}`);
        button.title = `${name}: ${point.title}`;
        button.disabled = index + delta < 0 || index + delta >= state.points.length;
        button.addEventListener('click', () => {
          state.points = C.movePoint(state.points, index, index + delta);
          updatePlan();
          const movedRow = $('stops-list').children[index + delta];
          movedRow?.querySelector('.stop-content')?.focus({ preventScroll: true });
        });
        moves.append(button);
      }
      actions.append(moves);
      const remove = element('button', 'remove-stop');
      remove.append(icon('close'));
      remove.title = 'Удалить точку';
      remove.setAttribute('aria-label', `Удалить: ${point.title}`);
      remove.addEventListener('click', () => {
        const previous = state.points.slice();
        const cityId = state.city.id;
        state.points.splice(index, 1);
        updatePlan();
        toast('Точка удалена', () => {
          if (state.city.id === cityId) { state.points = previous; updatePlan(); }
        });
      });
      actions.append(remove);
      li.append(actions);
      list.append(li);
    });
    $('stops-empty').hidden = state.points.length > 0;
    $('clear-button').disabled = state.points.length === 0;
    $('point-count').textContent = countLabel(state.points.length);
    $('map-welcome').hidden = state.points.length > 0 || state.picking;
    $('address').disabled = state.points.length >= config.maxPoints;
    $('address').placeholder = state.points.length >= config.maxPoints ? 'Достигнут лимит: 20 точек' : 'Введите улицу и номер дома';
    $('search-hint').textContent = state.points.length >= config.maxPoints ? 'Удалите точку, чтобы добавить другую' : 'Подсказки появятся после 3 символов';
    $('pick-button').disabled = state.points.length >= config.maxPoints;
    renderMarkers();
    renderBuild();
  }

  function renderMarkers() {
    if (!map) return;
    markers.clearLayers();
    state.points.forEach((point, index) => {
      const badge = element('span', `map-point${index === 0 ? ' start' : index === state.points.length - 1 ? ' end' : ''}`, index + 1);
      const marker = L.marker([point.lat, point.lon], {
        icon: L.divIcon({ className: 'map-point-container', html: badge.outerHTML, iconSize: [34, 34], iconAnchor: [17, 17] }),
        title: `${index + 1}. ${point.title}`, keyboard: true,
      });
      const tooltip = element('span', '', `${index + 1}. ${point.title}`);
      marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -18] });
      marker.addTo(markers);
    });
  }

  function fitPlan() {
    if (!map) return;
    if (state.route) map.fitBounds(L.latLngBounds(state.route.coordinates), { paddingTopLeft: [45, 100], paddingBottomRight: [65, 145], maxZoom: 16 });
    else if (state.points.length) map.fitBounds(L.latLngBounds(state.points.map(p => [p.lat, p.lon])), { padding: [65, 90], maxZoom: 16 });
    else map.setView([state.city.lat, state.city.lon], 13);
  }

  function initMap() {
    if (!window.L) { $('map-unavailable').hidden = false; return; }
    map = L.map('map', { zoomControl: false, minZoom: 3, maxZoom: 19, scrollWheelZoom: true });
    map.setView([state.city.lat, state.city.lon], 13);
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
    tiles = L.tileLayer(config.tileUrl, { attribution: config.tileAttribution, maxZoom: 19, keepBuffer: 1, updateWhenIdle: true, crossOrigin: true });
    tiles.on('tileload', () => { tilesLoaded++; $('map-unavailable').hidden = true; });
    tiles.on('tileerror', () => { tileErrors++; if (tileErrors >= 3 && tilesLoaded === 0) $('map-unavailable').hidden = false; });
    tiles.addTo(map);
    markers = L.layerGroup().addTo(map);
    map.on('click', event => {
      if (!state.picking) return;
      const point = {
        id: `map-${event.latlng.lat.toFixed(6)}-${event.latlng.lng.toFixed(6)}`,
        title: 'Точка на карте', subtitle: `${state.city.name} · ${event.latlng.lat.toFixed(5)}, ${event.latlng.lng.toFixed(5)}`,
        lat: event.latlng.lat, lon: event.latlng.lng, kind: 'Координаты',
      };
      if (!C.isInCity(point, state.city)) { toast('Выберите точку ближе к выбранному городу или смените город.'); return; }
      if (addPoint(point)) setPicking(false);
    });
    map.on('dragstart', () => { if (navigation) setFollow(false); });
    new ResizeObserver(() => map.invalidateSize()).observe($('map'));
    if (state.points.length) fitPlan();
  }

  function setPicking(value) {
    state.picking = value;
    $('pick-button').setAttribute('aria-pressed', String(value));
    $('map-pick-hint').hidden = !value;
    document.querySelector('.map-section').classList.toggle('picking', value);
    $('map-welcome').hidden = value || state.points.length > 0;
    if (value) {
      resetSearch();
      if (matchMedia('(max-width:760px)').matches) $('map').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function addPoint(point) {
    if (state.points.length >= config.maxPoints) { toast(`Можно добавить до ${config.maxPoints} точек.`); return false; }
    if (state.points.some(p => p.id === point.id || Math.abs(p.lat - point.lat) < .00001 && Math.abs(p.lon - point.lon) < .00001)) {
      toast('Этот адрес уже есть в маршруте.');
      return false;
    }
    state.points.push(point);
    resetSearch();
    updatePlan();
    map?.panTo([point.lat, point.lon]);
    return true;
  }

  function setCity(city) {
    if (state.city.id === city.id) { closeCityPicker(); closeCountryPicker(); return; }
    const previous = { city: state.city, points: state.points.slice() };
    state.city = city;
    state.points = [];
    resetSearch();
    setPicking(false);
    closeCityPicker();
    closeCountryPicker();
    renderCity();
    updatePlan();
    locationMarker?.remove();
    accuracyCircle?.remove();
    locationMarker = null;
    accuracyCircle = null;
    latestFix = null;
    map?.setView([city.lat, city.lon], 13);
    if (previous.points.length) toast(`Выбран город ${city.name}. Начните новый маршрут.`, () => {
      state.city = previous.city;
      state.points = previous.points;
      resetSearch();
      renderCity();
      updatePlan();
      fitPlan();
    });
  }

  function renderCity() {
    $('city-name').textContent = state.city.name;
    const country = C.COUNTRIES.find(c => c.code === state.city.country);
    $('country').value = country.name;
    $('map-city').textContent = `${state.city.name}, ${country.name}`;
    $('address').setAttribute('aria-label', `Найти адрес: ${state.city.name}`);
  }

  function countryMatches() {
    const query = $('country').value.trim();
    const countries = C.findCountries(query);
    if (query) return countries;
    return countries.sort((a, b) => Number(b.code === state.city.country) - Number(a.code === state.city.country));
  }

  function chooseCountry(country) {
    if (country.code === state.city.country) { closeCountryPicker(); $('country').select(); return; }
    const city = C.CITIES.find(c => c.country === country.code);
    if (!city) return;
    setCity(city);
    closeCountryPicker();
    $('country').select();
  }

  function renderCountryOptions() {
    const list = $('country-list');
    list.replaceChildren();
    activeCountry = -1;
    $('country').removeAttribute('aria-activedescendant');
    for (const country of countryMatches()) {
      const button = element('button', 'country-option');
      button.type = 'button';
      button.id = `country-option-${country.code}`;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(country.code === state.city.country));
      button.tabIndex = -1;
      button.append(element('span', '', country.name));
      const details = element('span', 'country-option-details');
      details.append(element('small', '', country.code));
      if (country.code === state.city.country) details.append(icon('check'));
      button.append(details);
      button.addEventListener('mousedown', event => event.preventDefault());
      button.addEventListener('click', () => chooseCountry(country));
      list.append(button);
    }
    if (!list.children.length) list.append(element('p', 'country-no-results', 'Страна не найдена в текущем справочнике. Попробуйте другое название.'));
  }

  function positionCountryPicker() {
    if ($('country-picker').hidden) return;
    const field = document.querySelector('.country-field').getBoundingClientRect();
    const panel = document.querySelector('.planner-scroll').getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewTop = viewport?.offsetTop || 0;
    const viewBottom = viewTop + (viewport?.height || window.innerHeight);
    const below = Math.min(panel.bottom, viewBottom) - field.bottom - 16;
    const above = field.top - Math.max(panel.top, viewTop) - 16;
    const up = below < 160 && above > below;
    $('country-picker').classList.toggle('opens-up', up);
    $('country-list').style.maxHeight = `${Math.max(48, Math.min(250, (up ? above : below) - 52))}px`;
  }

  function openCountryPicker(clear = false) {
    closeCityPicker();
    resetSearch(false);
    if (clear) $('country').value = '';
    $('country-picker').hidden = false;
    $('country').setAttribute('aria-expanded', 'true');
    renderCountryOptions();
    positionCountryPicker();
  }

  function closeCountryPicker() {
    $('country-picker').hidden = true;
    $('country').setAttribute('aria-expanded', 'false');
    $('country').removeAttribute('aria-activedescendant');
    activeCountry = -1;
    $('country').value = C.COUNTRIES.find(c => c.code === state.city.country).name;
  }

  function cityMatches() {
    const query = C.normalize($('city-search').value);
    return C.CITIES.filter(c => c.country === state.city.country && C.normalize(c.name).includes(query));
  }

  function renderCityOptions() {
    const list = $('city-list');
    list.replaceChildren();
    const matches = cityMatches();
    activeCity = -1;
    $('city-search').removeAttribute('aria-activedescendant');
    matches.forEach((city, index) => {
      const button = element('button', 'city-option', city.name);
      button.id = `city-option-${index}`;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(city.id === state.city.id));
      button.tabIndex = -1;
      if (city.id === state.city.id) button.append(icon('check'));
      button.addEventListener('mousedown', e => e.preventDefault());
      button.addEventListener('click', () => { setCity(city); $('city-button').focus(); });
      list.append(button);
    });
    if (!matches.length) list.append(element('p', 'empty-city', 'Город пока не добавлен в эту версию.'));
  }

  function closeCityPicker() {
    $('city-picker').hidden = true;
    $('city-button').setAttribute('aria-expanded', 'false');
  }

  async function fetchJson(url, controller, timeout = 18000) {
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeout);
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: 'omit' });
      if (!response.ok) throw new Error(response.status === 429 ? 'Сервис временно ограничил запросы. Подождите немного и повторите.' : `Сервис недоступен (HTTP ${response.status}). Попробуйте позже.`);
      return await response.json();
    } catch (error) {
      if (timedOut) throw new Error('Сервис долго не отвечает. Повторите попытку.');
      if (error.name === 'TypeError') throw new Error('Не удалось подключиться к сервису. Проверьте интернет или повторите позже.');
      throw error;
    } finally { clearTimeout(timer); }
  }

  function setSearchMessage(message, retry = false) {
    $('suggestions').replaceChildren();
    suggestions = [];
    activeSuggestion = -1;
    $('address').removeAttribute('aria-activedescendant');
    $('search-message').textContent = message;
    if (retry) {
      const button = element('button', '', 'Повторить поиск');
      button.addEventListener('click', () => queueSearch(true));
      $('search-message').append(button);
    }
    $('suggestions-panel').hidden = false;
    $('address').setAttribute('aria-expanded', 'true');
  }

  function renderSuggestions(points) {
    suggestions = points;
    activeSuggestion = -1;
    $('address').removeAttribute('aria-activedescendant');
    const list = $('suggestions');
    list.replaceChildren();
    $('search-message').textContent = '';
    points.forEach((point, index) => {
      const button = element('button', 'suggestion');
      button.id = `suggestion-${index}`;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', 'false');
      button.tabIndex = -1;
      button.append(icon('pin'));
      const text = element('span', 'suggestion-text');
      text.append(element('strong', '', point.title));
      text.append(element('small', '', point.subtitle));
      button.append(text, element('span', 'suggestion-kind', point.kind));
      button.addEventListener('mousedown', e => e.preventDefault());
      button.addEventListener('click', () => { addPoint(point); $('address').focus({ preventScroll: true }); });
      list.append(button);
    });
    if (!points.length) setSearchMessage('Адрес не найден. Попробуйте другое название улицы, уточните номер дома или поставьте точку на карте.');
    $('suggestions-panel').hidden = false;
    $('address').setAttribute('aria-expanded', 'true');
  }

  function queueSearch(immediate = false) {
    resetSearch(false);
    const query = $('address').value.trim();
    if (query.length < 3 || state.points.length >= config.maxPoints) return;
    const generation = searchGeneration;
    const city = state.city;
    const key = `${city.id}:${C.normalize(query)}`;
    if (cache.has(key)) { renderSuggestions(cache.get(key)); return; }
    $('search-spinner').hidden = false;
    const delay = Math.max(immediate ? 0 : config.searchDelay, lastSearchAt + 1100 - Date.now());
    searchTimer = setTimeout(async () => {
      if (generation !== searchGeneration) return;
      const controller = new AbortController();
      searchController = controller;
      lastSearchAt = Date.now();
      try {
        const data = await fetchJson(C.photonUrl(config.photonUrl, query, city), controller);
        if (generation !== searchGeneration) return;
        const points = C.photonPoints(data, city);
        if (cache.size >= 100) cache.delete(cache.keys().next().value);
        cache.set(key, points);
        renderSuggestions(points);
      } catch (error) {
        if (generation === searchGeneration && error.name !== 'AbortError') setSearchMessage(error.message, true);
      } finally {
        if (generation === searchGeneration) $('search-spinner').hidden = true;
      }
    }, delay);
  }

  async function buildRoute() {
    if (state.points.length < 2 || state.loading || state.route) return;
    resetSearch(false);
    setPicking(false);
    const generation = ++routeGeneration;
    const controller = new AbortController();
    routeController = controller;
    const points = state.points.slice();
    state.loading = true;
    $('route-error').hidden = true;
    renderBuild();
    try {
      const delay = lastRouteAt + 1100 - Date.now();
      if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
      if (generation !== routeGeneration) return;
      lastRouteAt = Date.now();
      const data = await fetchJson(C.routeUrl(config.osrmUrl, points), controller, 25000);
      if (generation !== routeGeneration) return;
      state.route = C.parseRoute(data, points.length);
      try {
        navigationPlan = N.prepare(state.route, points);
        $('navigation-note').textContent = 'Держите вкладку открытой и экран включённым. Геолокация работает по HTTPS или на localhost.';
      } catch (error) {
        navigationPlan = null;
        $('navigation-note').textContent = error.message;
      }
      renderNavigationControls();
      if (map) {
        routeOutline = L.polyline(state.route.coordinates, { color: '#fff', weight: 9, opacity: .9, interactive: false }).addTo(map);
        routeLine = L.polyline(state.route.coordinates, { color: '#568254', weight: 5, opacity: 1, lineCap: 'round', interactive: false }).addTo(map);
        renderMarkers();
        fitPlan();
      }
      $('summary-distance').textContent = C.formatDistance(state.route.distance);
      $('summary-duration').textContent = C.formatDuration(state.route.duration);
      $('map-summary').hidden = false;
      $('route-details').hidden = false;
      $('leg-list').replaceChildren();
      state.route.legs.forEach((leg, index) => {
        const li = element('li');
        li.append(element('span', '', `${index + 1} → ${index + 2} · ${points[index + 1].title}`));
        li.append(element('strong', '', `${C.formatDistance(leg.distance)} · ${C.formatDuration(leg.duration)}`));
        $('leg-list').append(li);
      });
      const farSnaps = state.route.snapped.some(w => Number(w.distance) > 150);
      toast(farSnaps ? 'Маршрут готов. Некоторые точки привязаны к дороге дальше чем в 150 м — проверьте подъезд.' : 'Маршрут готов. Хорошей дороги!');
      if (matchMedia('(max-width:760px)').matches) $('map').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      if (generation === routeGeneration && error.name !== 'AbortError') {
        $('route-error').textContent = error.message;
        $('route-error').hidden = false;
      }
    } finally {
      if (generation === routeGeneration) { state.loading = false; renderBuild(); }
    }
  }

  function renderNavigationControls() {
    $('navigate-button').disabled = !navigationPlan;
    $('navigate-button').textContent = navigation ? 'Остановить навигацию' : 'Начать навигацию';
    $('demo-button').disabled = !navigationPlan || !!navigation;
  }

  function setFollow(value) {
    followPosition = value;
    $('follow-position').setAttribute('aria-pressed', String(value));
    $('follow-position').textContent = value ? 'Следим за позицией' : 'Вернуться к позиции';
    if (value && latestFix && map) map.setView([latestFix.lat, latestFix.lon], Math.max(16, map.getZoom()), { animate: false });
  }

  function showPosition(fix, follow = false) {
    if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lon) || Math.abs(fix.lat) > 90 || Math.abs(fix.lon) > 180) return;
    latestFix = fix;
    if (!map) return;
    const latlng = [fix.lat, fix.lon];
    if (locationMarker) locationMarker.setLatLng(latlng);
    else locationMarker = L.marker(latlng, { icon: L.divIcon({ className: 'gps-position-container', html: '<span class="gps-position"></span>', iconSize: [20, 20], iconAnchor: [10, 10] }), zIndexOffset: 1000, keyboard: false, interactive: false }).addTo(map);
    if (accuracyCircle) accuracyCircle.setLatLng(latlng).setRadius(fix.accuracy);
    else accuracyCircle = L.circle(latlng, { radius: Math.max(0, fix.accuracy), color: '#4d91c5', weight: 1, opacity: .3, fillOpacity: .07, interactive: false }).addTo(map);
    if (follow && fix.accuracy <= 80) map.setView(latlng, Math.max(16, map.getZoom()), { animate: false });
  }

  function stopNavigation() {
    if (navigation) {
      navigation.stop();
      navigation = null;
      locationMarker?.remove(); accuracyCircle?.remove();
      locationMarker = null; accuracyCircle = null; latestFix = null;
    }
    $('navigation-card').hidden = true;
    document.querySelector('.map-section').classList.remove('navigating');
    renderNavigationControls();
  }

  function showGuidance(result) {
    const event = result.event;
    $('navigation-mode').textContent = result.mode === 'demo' ? 'ДЕМО ПОЕЗДКИ · БЕЗ GPS' : 'НАВИГАЦИЯ · GPS';
    $('navigation-card').dataset.warning = String(['weak', 'stale', 'offroute', 'start'].includes(result.status));
    $('continue-navigation').hidden = result.status !== 'stop';
    $('navigation-remaining').textContent = Number.isFinite(result.remaining) ? `До финиша: ${C.formatDistance(result.remaining)}` : '';
    $('navigation-accuracy').textContent = result.mode === 'demo' ? 'Симуляция' : Number.isFinite(result.accuracy) ? `Точность ±${Math.round(result.accuracy)} м` : '';
    $('navigation-road').textContent = '';
    $('navigation-symbol').textContent = event?.symbol || '⌖';
    if (result.status === 'onroute') {
      $('navigation-distance').textContent = result.distance <= 25 ? 'Сейчас' : `Через ${C.formatDistance(result.distance)}`;
      $('navigation-instruction').textContent = event.text;
      $('navigation-road').textContent = event.type === 'arrive' ? event.destination : event.road;
    } else if (result.status === 'stop' || result.status === 'arrived') {
      $('navigation-distance').textContent = result.status === 'arrived' ? 'Маршрут завершён' : 'Остановка по маршруту';
      $('navigation-instruction').textContent = event?.text || 'Вы достигли финиша';
      $('navigation-road').textContent = event?.destination || '';
      if (result.status === 'arrived') $('navigate-button').textContent = 'Завершить навигацию';
    } else {
      const messages = {
        waiting: ['Ожидаем позицию', result.message || (result.mode === 'demo' ? 'Готовим демонстрацию…' : 'Ждём сигнал GPS…')],
        paused: ['Навигация приостановлена', 'Вкладка скрыта. Вернитесь, чтобы продолжить.'],
        weak: ['Повороты временно не подсказываются', 'Недостаточная точность GPS'],
        stale: ['Повороты временно не подсказываются', 'Сигнал GPS потерян'],
        offroute: ['Повороты временно не подсказываются', 'Вы вне маршрута'],
        start: [Number.isFinite(result.toStart) ? `До начала: ${C.formatDistance(result.toStart)}` : 'До начала маршрута', 'Вы далеко от старта'],
      };
      const [caption, title] = messages[result.status] || messages.waiting;
      $('navigation-distance').textContent = caption;
      $('navigation-instruction').textContent = title;
      $('navigation-symbol').textContent = result.status === 'offroute' ? '↶' : '⌖';
      if (result.status === 'offroute') $('navigation-road').textContent = 'Вернитесь на линию или остановите навигацию и перестройте путь.';
      if (result.status === 'start') $('navigation-road').textContent = 'Остановите навигацию, добавьте свою позицию в начало и перестройте путь.';
    }
  }

  function startNavigation(mode) {
    if (navigation) { stopNavigation(); return; }
    if (!navigationPlan) return;
    if (mode === 'gps' && (!window.isSecureContext || !navigator.geolocation)) {
      toast('Для GPS откройте Mapuga по HTTPS или на localhost и разрешите геолокацию в браузере.');
      return;
    }
    resetSearch(false);
    clearTimeout(toastTimer);
    $('toast').hidden = true;
    undoAction = null;
    setPicking(false);
    setFollow(true);
    $('navigation-card').hidden = false;
    document.querySelector('.map-section').classList.add('navigating');
    navigation = window.MapugaNavigationSession.create({
      plan: navigationPlan, mode, voice: $('voice-enabled').checked,
      onUpdate: showGuidance,
      onFix: fix => showPosition(fix, followPosition),
      onError: message => { stopNavigation(); toast(message); },
    });
    renderNavigationControls();
    navigation.start();
    if (matchMedia('(max-width:760px)').matches) $('map').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function requestPosition(asStart = false) {
    if (!window.isSecureContext || !navigator.geolocation) { toast('Геолокация требует HTTPS или localhost и разрешения браузера.'); return; }
    if (asStart && state.points.length >= config.maxPoints && state.points[0]?.kind !== 'Геопозиция') { toast('Удалите одну точку, чтобы добавить текущую позицию в начало.'); return; }
    const cityId = state.city.id;
    $('locate-button').disabled = true;
    $('gps-start-button').disabled = true;
    navigator.geolocation.getCurrentPosition(position => {
      $('locate-button').disabled = false;
      $('gps-start-button').disabled = false;
      if (cityId !== state.city.id) { toast('Город изменился. Запросите позицию ещё раз.'); return; }
      const fix = { lat: position.coords.latitude, lon: position.coords.longitude, accuracy: position.coords.accuracy };
      if (Date.now() - position.timestamp > 15000 || !Number.isFinite(fix.accuracy) || fix.accuracy > 80) { toast('Позиция пока недостаточно точная. Включите точную геолокацию и попробуйте ещё раз.'); return; }
      if (asStart) {
        if (!C.isInCity(fix, state.city)) { toast('Вы вне области выбранного города. Сначала выберите свой город.'); return; }
        if (state.points[0] && state.points[0].kind !== 'Геопозиция' && N.distance([fix.lat, fix.lon], [state.points[0].lat, state.points[0].lon]) < 5) { toast('Начальная точка уже совпадает с вашей позицией.'); return; }
        const point = { id: 'gps-start', title: 'Моя позиция', subtitle: `${state.city.name} · ${fix.lat.toFixed(5)}, ${fix.lon.toFixed(5)}`, lat: fix.lat, lon: fix.lon, kind: 'Геопозиция' };
        const rest = state.points.filter(p => p.id !== 'gps-start');
        if (rest.length >= config.maxPoints) { toast('Список уже заполнен. Удалите точку и попробуйте снова.'); return; }
        state.points = [point, ...rest];
        updatePlan();
        toast('Ваша позиция добавлена в начало. Постройте маршрут.');
      }
      showPosition(fix, true);
      if (!asStart) toast('Ваша позиция показана синим. Чтобы начать путь отсюда, нажмите «Добавить мою позицию в начало».');
    }, error => {
      $('locate-button').disabled = false;
      $('gps-start-button').disabled = false;
      toast(error.code === 1 ? 'Доступ к геолокации запрещён. Разрешите его для Mapuga в настройках браузера.' : 'Не удалось определить позицию. Включите геолокацию и повторите попытку.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }

  $('country').addEventListener('focus', () => openCountryPicker(true));
  $('country').addEventListener('click', () => { if ($('country-picker').hidden) openCountryPicker(true); });
  $('country').addEventListener('input', () => openCountryPicker());
  $('country-toggle').addEventListener('mousedown', event => event.preventDefault());
  $('country-toggle').addEventListener('click', () => {
    if (!$('country-picker').hidden) { closeCountryPicker(); return; }
    $('country').focus();
    openCountryPicker(true);
  });
  $('country').addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closeCountryPicker(); return; }
    if (event.key === 'Tab') { closeCountryPicker(); return; }
    if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return;
    event.preventDefault();
    if ($('country-picker').hidden) { openCountryPicker(true); if (event.key === 'Enter') return; }
    const matches = countryMatches();
    if (!matches.length) return;
    if (event.key === 'Enter') { chooseCountry(matches[activeCountry >= 0 ? activeCountry : 0]); return; }
    const down = event.key === 'ArrowDown';
    activeCountry = activeCountry < 0 ? (down ? 0 : matches.length - 1) : (activeCountry + (down ? 1 : -1) + matches.length) % matches.length;
    [...$('country-list').children].forEach((node, index) => node.classList.toggle('active', index === activeCountry));
    const option = $('country-list').children[activeCountry];
    $('country').setAttribute('aria-activedescendant', option.id);
    option.scrollIntoView({ block: 'nearest' });
  });
  window.addEventListener('resize', positionCountryPicker);
  window.addEventListener('scroll', positionCountryPicker, { passive: true });
  window.visualViewport?.addEventListener('resize', positionCountryPicker);
  window.visualViewport?.addEventListener('scroll', positionCountryPicker);
  document.querySelector('.planner-scroll').addEventListener('scroll', positionCountryPicker, { passive: true });
  $('city-button').addEventListener('click', () => {
    if (!$('city-picker').hidden) { closeCityPicker(); return; }
    resetSearch(false);
    closeCountryPicker();
    $('city-picker').hidden = false;
    $('city-button').setAttribute('aria-expanded', 'true');
    $('city-search').value = '';
    renderCityOptions();
    $('city-search').focus();
  });
  $('city-search').addEventListener('input', renderCityOptions);
  $('city-search').addEventListener('keydown', event => {
    const matches = cityMatches();
    if (event.key === 'Escape') { closeCityPicker(); $('city-button').focus(); return; }
    if (event.key === 'Enter' && activeCity >= 0 && matches[activeCity]) { event.preventDefault(); setCity(matches[activeCity]); $('city-button').focus(); return; }
    if (!['ArrowDown', 'ArrowUp'].includes(event.key) || !matches.length) return;
    event.preventDefault();
    activeCity = activeCity < 0 ? (event.key === 'ArrowDown' ? 0 : matches.length - 1) : (activeCity + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
    [...$('city-list').children].forEach((child, index) => child.classList.toggle('active', index === activeCity));
    $('city-search').setAttribute('aria-activedescendant', `city-option-${activeCity}`);
    $('city-list').children[activeCity].scrollIntoView({ block: 'nearest' });
  });
  $('address').addEventListener('input', () => { setPicking(false); queueSearch(); });
  $('address').addEventListener('focus', () => { if ($('address').value.trim().length >= 3) queueSearch(); });
  $('address').addEventListener('keydown', event => {
    if (event.key === 'Escape') { resetSearch(false); return; }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (activeSuggestion >= 0 && suggestions[activeSuggestion]) addPoint(suggestions[activeSuggestion]);
      else queueSearch(true);
      return;
    }
    if (!['ArrowDown', 'ArrowUp'].includes(event.key) || !suggestions.length || $('suggestions-panel').hidden) return;
    event.preventDefault();
    activeSuggestion = (activeSuggestion + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length;
    [...$('suggestions').children].forEach((node, index) => {
      node.classList.toggle('active', index === activeSuggestion);
      node.setAttribute('aria-selected', String(index === activeSuggestion));
    });
    $('address').setAttribute('aria-activedescendant', `suggestion-${activeSuggestion}`);
    $('suggestions').children[activeSuggestion].scrollIntoView({ block: 'nearest' });
  });
  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('.country-field')) closeCountryPicker();
    if (!event.target.closest('.city-field')) closeCityPicker();
    if (!event.target.closest('.search-section')) resetSearch(false);
  });
  document.addEventListener('focusin', event => {
    if (!event.target.closest('.country-field')) closeCountryPicker();
    if (!event.target.closest('.city-field')) closeCityPicker();
    if (!event.target.closest('.search-section')) resetSearch(false);
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') setPicking(false); });
  $('build-button').addEventListener('click', buildRoute);
  $('clear-button').addEventListener('click', () => {
    const previous = state.points.slice();
    const cityId = state.city.id;
    state.points = [];
    resetSearch();
    setPicking(false);
    updatePlan();
    toast('Список остановок очищен', () => {
      if (state.city.id === cityId) { state.points = previous; updatePlan(); fitPlan(); }
    });
  });
  $('pick-button').addEventListener('click', () => {
    if (!map) { toast('Карта не загрузилась. Проверьте подключение.'); return; }
    setPicking(!state.picking);
  });
  $('cancel-pick').addEventListener('click', () => setPicking(false));
  $('fit-button').addEventListener('click', fitPlan);
  $('zoom-in').addEventListener('click', () => map?.zoomIn());
  $('zoom-out').addEventListener('click', () => map?.zoomOut());
  $('retry-map').addEventListener('click', () => {
    if (!window.L) { window.location.reload(); return; }
    tileErrors = 0; tilesLoaded = 0;
    $('map-unavailable').hidden = true;
    tiles.redraw();
  });
  $('locate-button').addEventListener('click', () => {
    if (navigation) setFollow(true);
    else requestPosition();
  });
  $('gps-start-button').addEventListener('click', () => requestPosition(true));
  $('navigate-button').addEventListener('click', () => startNavigation('gps'));
  $('demo-button').addEventListener('click', () => startNavigation('demo'));
  $('stop-navigation').addEventListener('click', stopNavigation);
  $('continue-navigation').addEventListener('click', () => navigation?.nextLeg());
  $('follow-position').addEventListener('click', () => setFollow(!followPosition));
  $('voice-enabled').addEventListener('change', () => {
    navigation?.setVoice($('voice-enabled').checked);
    if ($('voice-enabled').checked) navigation?.say('Голосовые подсказки включены.');
  });
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    $('voice-enabled').checked = false;
    $('voice-enabled').disabled = true;
    $('voice-enabled').parentElement.title = 'В этом браузере нет синтеза речи. Текстовые подсказки доступны.';
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) navigation?.pause();
    else navigation?.resume();
  });
  window.addEventListener('pagehide', stopNavigation);
  $('export-button').addEventListener('click', () => {
    if (!state.route) return;
    const url = URL.createObjectURL(new Blob([C.toGpx(state.points, state.route)], { type: 'application/gpx+xml;charset=utf-8' }));
    const link = element('a');
    link.href = url;
    link.download = `mapuga-${state.city.id}.gpx`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('toast-close').addEventListener('click', () => { clearTimeout(toastTimer); $('toast').hidden = true; undoAction = null; });
  $('undo-button').addEventListener('click', () => {
    const undo = undoAction;
    undoAction = null;
    $('toast').hidden = true;
    clearTimeout(toastTimer);
    undo?.();
  });
  $('help-button').addEventListener('click', () => $('help-dialog').showModal());
  $('close-help').addEventListener('click', () => $('help-dialog').close());
  $('start-planning').addEventListener('click', () => { $('help-dialog').close(); $('address').focus(); });
  $('help-dialog').addEventListener('click', event => {
    if (event.target === $('help-dialog')) {
      const rect = $('help-dialog').getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $('help-dialog').close();
    }
  });
  window.addEventListener('offline', () => toast('Интернет отключён. Список останется в браузере; поиск и маршруты заработают после подключения.'));
  renderCity();
  initMap();
  renderPoints();
  if (!storageAvailable) toast('Сохранение в браузере недоступно. Список будет храниться только до закрытия вкладки.');
})();
