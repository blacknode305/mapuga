(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./navigation.js') : root.MapugaNavigation);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MapugaNavigationSession = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (N) {
  'use strict';

  function create(options) {
    const {
      plan, mode = 'gps', geolocation = globalThis.navigator?.geolocation,
      synthesis = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance,
      onUpdate = () => {}, onFix = () => {}, onError = () => {},
      now = Date.now, timers = globalThis,
    } = options;
    const tracker = N.createTracker(plan);
    let active = false, paused = false, watchId = null, timer = null, generation = 0;
    let voice = options.voice !== false, lastFixAt = 0, stale = false, demoTime = now();

    function say(text) {
      if (!voice || !text || !synthesis || !Utterance || paused) return;
      try {
        synthesis.cancel();
        const utterance = new Utterance(text);
        utterance.lang = 'ru-RU';
        utterance.rate = 1;
        const voices = synthesis.getVoices();
        utterance.voice = voices.find(v => /^ru/i.test(v.lang) && v.localService) || voices.find(v => /^ru/i.test(v.lang)) || null;
        synthesis.speak(utterance);
      } catch { /* Text guidance stays available when the device has no speech engine. */ }
    }

    function clear(cancelSpeech = true) {
      generation++;
      if (watchId !== null) { geolocation?.clearWatch(watchId); watchId = null; }
      if (timer !== null) { timers.clearInterval(timer); timer = null; }
      if (cancelSpeech) synthesis?.cancel();
    }

    function publish(result) {
      onUpdate({ ...result, mode });
      say(result.announcement);
      if (result.status === 'arrived') { active = false; clear(false); }
    }

    function receive(position, token) {
      if (!active || paused || token !== generation) return;
      const fix = {
        lat: position.coords.latitude, lon: position.coords.longitude,
        accuracy: position.coords.accuracy, speed: position.coords.speed,
        timestamp: position.timestamp,
      };
      const result = tracker.update(fix, mode === 'demo' ? position.timestamp : now());
      if (result.ignored) return;
      if (result.status !== 'stale') { lastFixAt = now(); stale = false; }
      if (result.status !== 'stale' && (result.status !== 'weak' || fix.accuracy > 80)) onFix(fix);
      publish({ ...result, accuracy: fix.accuracy });
    }

    function startSource() {
      const token = ++generation;
      lastFixAt = now(); stale = false;
      if (mode === 'demo') {
        let at = tracker.getProgress();
        const tick = () => {
          if (!active || paused || token !== generation || tracker.isPaused()) return;
          const checkpoint = plan.events[plan.checkpoints[tracker.getLeg()]];
          const p = N.pointAt(plan, at);
          demoTime += 1000;
          receive({ coords: { latitude: p[0], longitude: p[1], accuracy: 5, speed: 20 }, timestamp: demoTime }, token);
          at = Math.min(checkpoint.at, at + 20);
        };
        timer = timers.setInterval(tick, 250);
        tick();
        return;
      }
      if (!geolocation) { fail('Геолокация недоступна в этом браузере.'); return; }
      try {
        watchId = geolocation.watchPosition(position => receive(position, token), error => {
          if (!active || paused || token !== generation) return;
          if (error.code === 1) { fail('Доступ к геолокации запрещён. Разрешите его для Mapuga в браузере и запустите навигацию снова.'); return; }
          synthesis?.cancel();
          onUpdate({ status: 'waiting', mode, message: error.code === 3 ? 'Позиция пока не определена. Ждём сигнал GPS…' : 'GPS временно недоступен. Ожидаем позицию…' });
        }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
        if (!active) { geolocation.clearWatch(watchId); watchId = null; return; }
        timer = timers.setInterval(() => {
          if (active && !paused && !stale && now() - lastFixAt > 15000) {
            stale = true;
            synthesis?.cancel();
            publish({ status: 'stale', announcement: 'Сигнал GPS потерян. Ожидаем новую позицию.' });
          }
        }, 2000);
      } catch { fail('Не удалось включить геолокацию. Откройте Mapuga по HTTPS или на localhost и проверьте разрешение браузера.'); }
    }

    function fail(message) {
      active = false; paused = false; clear(); onError(message);
    }

    function start() {
      if (active) return;
      active = true;
      onUpdate({ status: 'waiting', mode });
      say(mode === 'demo' ? 'Демонстрация маршрута. Геолокация не используется.' : 'Навигация включена. Ожидаем геолокацию.');
      startSource();
    }

    function stop() { active = false; paused = false; clear(); }
    function pause() {
      if (!active || paused) return;
      paused = true; clear(); onUpdate({ status: 'paused', mode });
    }
    function resume() {
      if (!active || !paused) return;
      paused = false; onUpdate({ status: 'waiting', mode }); startSource();
    }
    function nextLeg() {
      if (!active || !tracker.nextLeg()) return false;
      say('Продолжаем к следующей остановке.');
      onUpdate({ status: 'waiting', mode, message: 'Продолжаем к следующей остановке…' });
      return true;
    }
    function setVoice(value) { voice = !!value; if (!voice) synthesis?.cancel(); }
    return { start, stop, pause, resume, nextLeg, setVoice, say, isActive: () => active, mode };
  }

  return { create };
});
