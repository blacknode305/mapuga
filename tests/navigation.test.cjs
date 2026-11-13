const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../dist/navigation.js');
const Session = require('../dist/navigation-session.js');

// Geometry takes two real turns and an intermediate stop, rather than mirroring tracker internals.
const a = [49.8, 73.08], b = [49.8, 73.084], c = [49.803, 73.084], d = [49.803, 73.087];
const step = (type, coordinates, modifier = 'straight', name = '') => ({
  maneuver: { type, modifier, location: [coordinates[0][1], coordinates[0][0]] },
  geometry: { type: 'LineString', coordinates: coordinates.map(([lat, lon]) => [lon, lat]) }, name,
});
const route = { distance: 835, legs: [
  { steps: [step('depart', [a, b]), step('turn', [b, c], 'left', 'Улица Северная'), step('arrive', [c, c])] },
  { steps: [step('depart', [c, d]), step('arrive', [d, d])] },
] };
const points = [{ title: 'Старт' }, { title: 'Первая доставка' }, { title: 'Финиш' }];
const plan = () => N.prepare(structuredClone(route), points);
const fix = (p, timestamp, accuracy = 5) => ({ lat: p[0], lon: p[1], timestamp, accuracy });

function travel(tracker, prepared, from, to, time = 100000, accuracy = 5) {
  let result;
  const announcements = [];
  for (let at = from; at < to; at += 20) {
    time += 1000; result = tracker.update(fix(N.pointAt(prepared, at), time, accuracy), time);
    if (result.announcement) announcements.push(result.announcement);
  }
  time += 1000;
  result = tracker.update(fix(N.pointAt(prepared, to), time, accuracy), time);
  if (result.announcement) announcements.push(result.announcement);
  return { result, time, announcements };
}

test('OSRM maneuvers become Russian turns, forks, U-turns and roundabout exits', () => {
  assert.equal(N.maneuverText({ type: 'turn', modifier: 'left' }), 'Поверните налево');
  assert.equal(N.maneuverText({ type: 'turn', modifier: 'right' }), 'Поверните направо');
  assert.equal(N.maneuverText({ type: 'continue', modifier: 'uturn' }), 'Развернитесь');
  assert.equal(N.maneuverText({ type: 'fork', modifier: 'slight right' }), 'На развилке держитесь правее');
  assert.match(N.maneuverText({ type: 'roundabout', exit: 3 }), /съезд № 3/);
  assert.equal(N.maneuverText({ type: 'roundabout turn', modifier: 'right' }), 'На круге поверните направо');
  assert.equal(N.maneuverText({ type: 'use lane', modifier: 'slight left' }), 'Держитесь левой полосы');
  assert.equal(N.maneuverText({ type: 'arrive' }, true), 'Вы достигли финиша');
});

test('Guidance rejects missing steps and malformed coordinates', () => {
  assert.throws(() => N.prepare({ legs: [{}] }, points), /инструкции/);
  const invalid = structuredClone(route);
  invalid.legs[0].steps[0].geometry.coordinates[0][0] = 999;
  assert.throws(() => N.prepare(invalid, points), /координаты/);
});

test('Moving along a road produces advance, near and immediate turn announcements only once', () => {
  const prepared = plan(), tracker = N.createTracker(prepared);
  const start = tracker.update(fix(a, 100000), 100000);
  assert.equal(start.status, 'onroute');
  assert.match(start.announcement, /налево/);
  assert.equal(tracker.update(fix(a, 101000), 101000).announcement, '');
  const near = travel(tracker, prepared, 20, prepared.events[0].at - 60, 101000);
  assert.equal(near.announcements.filter(s => /налево/.test(s)).length, 1);
  const immediate = travel(tracker, prepared, prepared.events[0].at - 40, prepared.events[0].at - 10, near.time);
  assert.deepEqual(immediate.announcements, ['Поверните налево. Улица Северная.']);
  assert.equal(tracker.update(fix(N.pointAt(prepared, prepared.events[0].at - 10), immediate.time + 1000), immediate.time + 1000).announcement, '');
  assert.equal(travel(tracker, prepared, prepared.events[0].at, prepared.events[0].at + 40, immediate.time + 1000).result.event.type, 'arrive');
});

test('Intermediate arrival pauses guidance until Continue; the next leg ends at the final destination', () => {
  const prepared = plan(), tracker = N.createTracker(prepared);
  const checkpoint = prepared.events[prepared.checkpoints[0]].at;
  const first = travel(tracker, prepared, 0, checkpoint);
  assert.equal(first.result.status, 'stop');
  assert.ok(first.announcements.some(s => /Первая доставка/.test(s)));
  assert.equal(tracker.update(fix(d, first.time + 10000), first.time + 10000).status, 'stop');
  assert.equal(tracker.nextLeg(), true);
  const second = travel(tracker, prepared, checkpoint, prepared.length, first.time + 11000);
  assert.equal(second.result.status, 'arrived');
  assert.equal(second.result.remaining, 0);
  assert.ok(second.announcements.some(s => /Финиш/.test(s)));
  assert.equal(tracker.nextLeg(), false);
});

test('GPS uncertainty, stale fixes, out-of-order fixes and leaving the road never advance guidance', () => {
  const prepared = plan(), tracker = N.createTracker(prepared);
  tracker.update(fix(a, 100000), 100000);
  assert.equal(tracker.update(fix(b, 101000, 300), 101000).status, 'weak');
  assert.equal(tracker.getProgress(), 0);
  assert.equal(tracker.update(fix(b, 102000), 120000).status, 'stale');
  assert.equal(tracker.update(fix(a, 100500), 101000).ignored, true);
  assert.equal(tracker.update(fix([49.8009, 73.08], 103000), 103000).status, 'offroute');
  assert.equal(tracker.getProgress(), 0);
});

test('Far-away starting positions and a loop ending near its start do not produce false arrivals', () => {
  const tracker = N.createTracker(plan());
  assert.equal(tracker.update(fix([50, 73], 100000), 100000).status, 'start');
  const loop = { distance: 1000, legs: [{ steps: [step('depart', [a, b]), step('turn', [b, c], 'left'), step('turn', [c, a], 'left'), step('arrive', [a, a])] }] };
  const result = N.createTracker(N.prepare(loop, [points[0], points[2]])).update(fix(a, 100000), 100000);
  assert.equal(result.status, 'onroute');
  assert.ok(result.remaining > 900);
});

function harness(extra = {}) {
  let clock = 100000, id = 0;
  const watches = [], cleared = [], intervals = new Map(), updates = [], spoken = [], errors = [], positions = [];
  const session = Session.create({
    plan: plan(), now: () => clock,
    geolocation: {
      watchPosition(success, error, options) { const watch = { id: watches.length, success, error, options }; watches.push(watch); return watch.id; },
      clearWatch(watchId) { cleared.push(watchId); },
    },
    timers: { setInterval(callback) { intervals.set(++id, callback); return id; }, clearInterval(timerId) { intervals.delete(timerId); } },
    synthesis: { cancel() { spoken.push('cancel'); }, getVoices() { return [{ lang: 'ru-RU', localService: true }]; }, speak(utterance) { spoken.push(utterance.text); } },
    Utterance: class { constructor(text) { this.text = text; } },
    onUpdate: result => updates.push(result), onFix: p => positions.push(p), onError: e => errors.push(e), ...extra,
  });
  const position = (p = a) => ({ coords: { latitude: p[0], longitude: p[1], accuracy: 5 }, timestamp: clock });
  return { session, watches, cleared, intervals, updates, spoken, errors, positions, position,
    advance(ms) { clock += ms; for (const callback of [...intervals.values()]) callback(); } };
}

test('GPS session asks for high accuracy, clears watch ID zero and speech, and ignores late callbacks after stop', () => {
  const h = harness(); h.session.start();
  assert.equal(h.watches[0].options.enableHighAccuracy, true);
  h.watches[0].success(h.position());
  assert.equal(h.updates.at(-1).status, 'onroute');
  assert.ok(h.spoken.some(s => /налево/.test(s)));
  h.session.stop();
  assert.deepEqual(h.cleared, [0]);
  assert.equal(h.intervals.size, 0);
  const count = h.updates.length;
  h.watches[0].success(h.position(b));
  assert.equal(h.updates.length, count);
  assert.equal(h.spoken.at(-1), 'cancel');
});

test('Permission denial stops tracking, while hiding and resuming starts a fresh watch', () => {
  const denied = harness(); denied.session.start(); denied.watches[0].error({ code: 1 });
  assert.equal(denied.session.isActive(), false);
  assert.match(denied.errors[0], /запрещён/);
  assert.equal(denied.intervals.size, 0);
  const h = harness(); h.session.start(); h.session.pause();
  assert.equal(h.updates.at(-1).status, 'paused');
  const count = h.updates.length;
  h.watches[0].success(h.position());
  assert.equal(h.updates.length, count);
  h.session.resume();
  assert.equal(h.watches.length, 2);
  h.watches[1].success(h.position());
  assert.equal(h.updates.at(-1).status, 'onroute');
  h.session.stop();
});

test('Lost GPS produces a stale warning even if no more position callbacks arrive', () => {
  const h = harness(); h.session.start(); h.watches[0].success(h.position());
  h.advance(16000);
  assert.equal(h.updates.at(-1).status, 'stale');
  h.advance(1000); h.watches[0].success(h.position());
  assert.equal(h.updates.at(-1).status, 'onroute');
  h.session.stop();
});

test('Demo mode never calls geolocation and mute cancels speech', () => {
  const h = harness({ mode: 'demo', voice: false }); h.session.start();
  assert.equal(h.watches.length, 0);
  assert.equal(h.updates.at(-1).mode, 'demo');
  assert.equal(h.updates.at(-1).status, 'onroute');
  h.advance(250);
  assert.ok(h.positions.length >= 2);
  assert.ok(!h.spoken.some(s => /налево/.test(s)));
  h.session.setVoice(true); h.session.say('Тест голоса');
  assert.equal(h.spoken.at(-1), 'Тест голоса');
  h.session.setVoice(false);
  assert.equal(h.spoken.at(-1), 'cancel');
  h.session.stop();
});

test('Reaching the final stop releases GPS and timers without cancelling the arrival announcement', () => {
  const h = harness(), prepared = plan(); h.session.start();
  const checkpoint = prepared.events[prepared.checkpoints[0]].at;
  for (const [from, to] of [[0, checkpoint], [checkpoint, prepared.length]]) {
    for (let at = from; at < to; at += 20) {
      h.advance(1000); h.watches[0].success(h.position(N.pointAt(prepared, at)));
    }
    h.advance(1000); h.watches[0].success(h.position(N.pointAt(prepared, to)));
    if (to === checkpoint) assert.equal(h.session.nextLeg(), true);
  }
  assert.equal(h.updates.at(-1).status, 'arrived');
  assert.equal(h.session.isActive(), false);
  assert.deepEqual(h.cleared, [0]);
  assert.equal(h.intervals.size, 0);
  assert.match(h.spoken.at(-1), /Финиш/);
});
