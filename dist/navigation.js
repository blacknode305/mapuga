(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MapugaNavigation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const R = 6371000;
  const rad = degrees => degrees * Math.PI / 180;
  const validCoordinate = c => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) <= 90 && Math.abs(c[1]) <= 180;

  function distance(a, b) {
    const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(Math.min(1, h)));
  }

  function maneuverText(step, final = false) {
    const m = step.maneuver || step;
    const modifier = m.modifier || 'straight';
    const direction = { left: 'налево', right: 'направо', 'slight left': 'плавно налево', 'slight right': 'плавно направо', 'sharp left': 'резко налево', 'sharp right': 'резко направо', straight: 'прямо' }[modifier] || 'прямо';
    if (m.type === 'arrive') return final ? 'Вы достигли финиша' : 'Вы достигли остановки';
    if (m.type === 'depart') return 'Начните движение по маршруту';
    if (modifier === 'uturn') return 'Развернитесь';
    if (m.type === 'roundabout turn') return modifier === 'straight' ? 'Проезжайте круг прямо' : `На круге поверните ${direction}`;
    if (['roundabout', 'rotary'].includes(m.type)) return Number.isInteger(m.exit) && m.exit > 0 ? `На круге выберите съезд № ${m.exit}` : 'Двигайтесь по кругу';
    if (['exit roundabout', 'exit rotary'].includes(m.type)) return 'Съезжайте с круга';
    if (m.type === 'merge') return `Вливайтесь в поток ${direction}`;
    if (m.type === 'fork') return modifier.includes('left') ? 'На развилке держитесь левее' : modifier.includes('right') ? 'На развилке держитесь правее' : 'На развилке двигайтесь прямо';
    if (m.type === 'use lane') return modifier.includes('left') ? 'Держитесь левой полосы' : modifier.includes('right') ? 'Держитесь правой полосы' : 'Продолжайте по своей полосе';
    if (m.type === 'on ramp') return `Выезжайте на дорогу ${direction}`;
    if (m.type === 'off ramp') return `Сверните на съезд ${direction}`;
    if (m.type === 'end of road') return `В конце дороги поверните ${direction}`;
    if (m.type === 'notification' || m.type === 'new name' || modifier === 'straight') return 'Продолжайте прямо';
    return `Поверните ${direction}`;
  }

  function maneuverSymbol(m) {
    if (m.type === 'arrive') return '⚑';
    if (m.modifier === 'uturn') return '↶';
    if (/roundabout|rotary/.test(m.type)) return '⟳';
    return { left: '↰', right: '↱', 'slight left': '↖', 'slight right': '↗', 'sharp left': '↰', 'sharp right': '↱' }[m.modifier] || '↑';
  }

  function prepare(route, points) {
    const path = [], offsets = [], events = [], checkpoints = [];
    let length = 0;
    function append(c) {
      if (!validCoordinate(c)) throw new Error('Некорректные координаты пошагового маршрута.');
      if (path.length) {
        const delta = distance(path[path.length - 1], c);
        if (delta < .01) return;
        length += delta;
      }
      path.push(c); offsets.push(length);
    }
    for (let legIndex = 0; legIndex < route.legs.length; legIndex++) {
      const steps = route.legs[legIndex].steps;
      if (!Array.isArray(steps) || !steps.length || steps[steps.length - 1]?.maneuver?.type !== 'arrive') throw new Error('Сервис не вернул пошаговые инструкции. Перестройте маршрут.');
      for (const step of steps) {
        const geometry = step.geometry?.coordinates;
        const m = step.maneuver;
        if (step.geometry?.type !== 'LineString' || !Array.isArray(geometry) || !geometry.length || typeof m?.type !== 'string' || !validCoordinate(m.location && [m.location[1], m.location[0]])) throw new Error('Сервис вернул неполные инструкции манёвров.');
        append([geometry[0][1], geometry[0][0]]);
        const at = length;
        if (m.type !== 'depart') {
          const final = m.type === 'arrive' && legIndex === route.legs.length - 1;
          const event = {
            at, legIndex, final, type: m.type, modifier: m.modifier || '', exit: m.exit,
            coordinate: [m.location[1], m.location[0]],
            text: m.type !== 'arrive' && typeof step.instructionText === 'string' && step.instructionText.trim() ? step.instructionText : maneuverText(step, final), symbol: maneuverSymbol(m),
            road: typeof step.name === 'string' ? step.name : '',
            destination: points[legIndex + 1]?.title || `Точка ${legIndex + 2}`,
          };
          events.push(event);
          if (m.type === 'arrive') checkpoints.push(events.length - 1);
        }
        for (let i = 1; i < geometry.length; i++) append([geometry[i][1], geometry[i][0]]);
      }
    }
    if (path.length < 2 || length < 1 || checkpoints.length !== route.legs.length) throw new Error('Недостаточно данных для навигации по этому маршруту.');
    return { path, offsets, events, checkpoints, length, distance: route.distance };
  }

  function pointAt(plan, at) {
    const value = Math.max(0, Math.min(plan.length, at));
    let low = 0, high = plan.offsets.length - 1;
    while (low + 1 < high) { const mid = (low + high) >> 1; if (plan.offsets[mid] <= value) low = mid; else high = mid; }
    const span = plan.offsets[high] - plan.offsets[low];
    const t = span ? (value - plan.offsets[low]) / span : 0;
    return [plan.path[low][0] + t * (plan.path[high][0] - plan.path[low][0]), plan.path[low][1] + t * (plan.path[high][1] - plan.path[low][1])];
  }

  function project(plan, position, min, max, previous) {
    const cos = Math.cos(rad(position[0]));
    let best = null;
    for (let i = 0; i < plan.path.length - 1; i++) {
      const start = plan.offsets[i], end = plan.offsets[i + 1];
      if (end < min || start > max) continue;
      const a = plan.path[i], b = plan.path[i + 1];
      const ax = rad(a[1] - position[1]) * R * cos, ay = rad(a[0] - position[0]) * R;
      const bx = rad(b[1] - position[1]) * R * cos, by = rad(b[0] - position[0]) * R;
      const dx = bx - ax, dy = by - ay, denominator = dx * dx + dy * dy;
      const raw = denominator ? -(ax * dx + ay * dy) / denominator : 0;
      const t = Math.max(0, Math.min(1, Math.max((min - start) / (end - start), Math.min((max - start) / (end - start), raw))));
      const lateral = Math.hypot(ax + t * dx, ay + t * dy);
      const at = start + (end - start) * t;
      // Prefer a nearby portion of the existing path over a later crossing or return leg.
      const score = lateral + Math.abs(at - previous) * .025;
      if (!best || score < best.score) best = { at, lateral, score };
    }
    return best;
  }

  function distancePhrase(meters) {
    const rounded = Math.max(10, Math.round(meters / 10) * 10);
    return rounded >= 1000 ? `${(rounded / 1000).toLocaleString('ru', { maximumFractionDigits: 1 })} километра` : `${rounded} метров`;
  }

  function createTracker(plan) {
    let progress = 0, index = 0, leg = 0, started = false, paused = false, finished = false;
    let lastTimestamp = -Infinity, lastAccepted = null, lastResult = null, lastAlert = '';
    const announced = new Set();
    const snapshot = (status, extra = {}) => {
      lastResult = { status, progress, index, leg, event: plan.events[index], remaining: Math.max(0, plan.distance * (1 - progress / plan.length)), ...extra };
      return lastResult;
    };
    function alert(status, text, extra) {
      const announcement = lastAlert === status ? '' : text;
      lastAlert = status;
      return snapshot(status, { announcement, ...extra });
    }
    function update(fix, now = Date.now()) {
      if (!validCoordinate([fix?.lat, fix?.lon]) || !Number.isFinite(fix.accuracy) || fix.accuracy < 0 || !Number.isFinite(fix.timestamp)) return alert('weak', 'Не удалось получить точную позицию.');
      if (now - fix.timestamp > 15000 || fix.timestamp - now > 5000) return alert('stale', 'Сигнал геолокации устарел. Ожидаем новую позицию.');
      if (fix.timestamp <= lastTimestamp) return { ...(lastResult || snapshot('waiting')), ignored: true };
      lastTimestamp = fix.timestamp;
      if (fix.accuracy > 80) return alert('weak', 'Низкая точность геолокации. Повороты временно не подсказываются.');
      if (finished) return snapshot('arrived');
      if (paused) return snapshot('stop');
      const coordinate = [fix.lat, fix.lon];
      if (!started && distance(coordinate, plan.path[0]) > 200) return alert('start', 'Вы далеко от начала маршрута. Добавьте свою позицию в начало и перестройте путь.', { toStart: distance(coordinate, plan.path[0]) });
      const dt = lastAccepted ? Math.max(1, (fix.timestamp - lastAccepted.timestamp) / 1000) : 1;
      if (lastAccepted && distance(coordinate, [lastAccepted.lat, lastAccepted.lon]) > Math.max(160, dt * 65 + fix.accuracy + lastAccepted.accuracy)) return alert('weak', 'Позиция GPS резко изменилась. Ожидаем точное положение.');
      const checkpoint = plan.events[plan.checkpoints[leg]];
      const max = Math.min(checkpoint.at, progress + (started ? Math.max(140, Math.min(dt, 15) * 65) : 220));
      const nearest = project(plan, coordinate, Math.max(0, progress - 35), max, progress);
      if (!nearest || nearest.lateral > Math.max(45, fix.accuracy * 1.5)) return alert('offroute', 'Вы отклонились от маршрута. Вернитесь на него или остановите навигацию и перестройте путь.');
      started = true;
      lastAccepted = fix;
      lastAlert = '';
      progress = Math.max(progress, nearest.at);
      while (index < plan.checkpoints[leg] && plan.events[index].at < progress - 20) index++;
      if (checkpoint.at - progress <= 25 && fix.accuracy <= 35 && distance(coordinate, checkpoint.coordinate) <= 35) {
        index = plan.checkpoints[leg]; progress = checkpoint.at;
        finished = checkpoint.final; paused = !finished;
        return snapshot(finished ? 'arrived' : 'stop', { announcement: `${checkpoint.text}. ${checkpoint.destination}.` });
      }
      const event = plan.events[index];
      const remaining = Math.max(0, event.at - progress);
      const phase = remaining <= 25 ? 'now' : remaining <= 80 ? 'near' : remaining <= 300 ? 'prepare' : '';
      let announcement = '';
      if (phase && !announced.has(`${index}:${phase}`)) {
        announced.add(`${index}:${phase}`);
        // Entering a closer phase must never later repeat an earlier warning after GPS drift.
        if (phase === 'now') { announced.add(`${index}:near`); announced.add(`${index}:prepare`); }
        if (phase === 'near') announced.add(`${index}:prepare`);
        if (event.type === 'arrive') announcement = `До ${event.final ? 'финиша' : 'остановки'} ${distancePhrase(remaining)}.`;
        else announcement = `${phase === 'now' ? '' : `Через ${distancePhrase(remaining)}. `}${event.text}.${event.road ? ` ${event.road}.` : ''}`;
      }
      return snapshot('onroute', { distance: remaining, announcement });
    }
    function nextLeg() {
      if (!paused || finished) return false;
      paused = false; leg++; index++; lastAccepted = null; lastAlert = '';
      return true;
    }
    return { update, nextLeg, getProgress: () => progress, getLeg: () => leg, isPaused: () => paused };
  }

  return { distance, maneuverText, maneuverSymbol, prepare, pointAt, createTracker };
});
