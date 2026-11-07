// @ts-nocheck
/* ===== ЗВУК БОЯ: синтез выстрелов/взрывов и радиопереговоры пилотов ===== */
export const Sfx = (() => {
  let ac = null, master = null, on = true, vol = .5, noiseBuf = null, lastV = 0, speaking = false, lastLine = {};
  const lim = {}; // ограничение частоты по типам звуков
  const ctx = () => {
    if (ac) return ac;
    try {
      const A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
      ac = new A(); master = ac.createGain(); master.gain.value = vol;
      const cmp = ac.createDynamicsCompressor(); master.connect(cmp); cmp.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null }
    return ac;
  };
  const ok = (key, ms) => { const n = performance.now(); if (n - (lim[key] || 0) < ms) return false; lim[key] = n; return true };
  const noise = (dur, f0, f1, g0, type = 'bandpass', q = 1) => {
    const a = ctx(); if (!a || !on) return;
    const s = a.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = a.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, a.currentTime); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), a.currentTime + dur);
    const g = a.createGain(); g.gain.setValueAtTime(g0, a.currentTime); g.gain.exponentialRampToValueAtTime(.0008, a.currentTime + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(); s.stop(a.currentTime + dur + .05);
  };
  const tone = (dur, f0, f1, g0, type = 'sine') => {
    const a = ctx(); if (!a || !on) return;
    const o = a.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, a.currentTime); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), a.currentTime + dur);
    const g = a.createGain(); g.gain.setValueAtTime(g0, a.currentTime); g.gain.exponentialRampToValueAtTime(.0008, a.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(a.currentTime + dur + .05);
  };
  const shot = kind => {
    if (!on || !ok('s' + kind, kind === 'rail' ? 90 : 160)) return;
    if (kind === 'rail') { tone(.09, 900, 120, .12, 'square'); noise(.08, 3000, 500, .08) }
    else if (kind === 'laser') { tone(.5, 1800, 300, .1, 'sawtooth'); tone(.35, 2600, 500, .05, 'sine') }
    else if (kind === 'missile') { noise(.7, 400, 1800, .1, 'bandpass', .7); tone(.3, 140, 60, .1, 'triangle') }
    else if (kind === 'flak') { noise(.06, 5000, 1500, .05, 'highpass') }
  };
  const boom = size => {
    if (!on || !ok('b', size > 10 ? 150 : 70)) return;
    const d = Math.min(2.4, .35 + size * .05);
    noise(d, 1200, 70, Math.min(.35, .1 + size * .012), 'lowpass', .6); tone(d * .8, 90, 28, Math.min(.3, .08 + size * .01), 'sine');
  };
  /* --- радио --- */
  const L = {
    contact: ['Контакт! Вижу противника.', 'Цели в зоне, дистанция сокращается.', 'Радар чист… нет, вижу их. Идут на нас.', 'Обнаружил группу, пеленг по носу.'],
    fire: ['Огонь!', 'Залп! Пошли снаряды.', 'Орудия, огонь по готовности.', 'Работаем по цели.', 'Даю очередь.'],
    laser: ['Лазер заряжен. Бью.', 'Луч ушёл, ждём перезарядку.', 'Линза горячая, выстрел сделан.'],
    missile: ['Ракеты в воздухе!', 'Пуск! Птички пошли.', 'Ракеты на сопровождении.'],
    inmis: ['Ракеты! Ракеты по курсу!', 'Внимание, ракетная атака!', 'ПВО, работайте по ракетам!'],
    hit: ['Попадание в борт!', 'Нас зацепило!', 'Есть пробитие, держимся.', 'Броня плывёт, слышите?'],
    mod: ['Потеряли орудие.', 'Модуль выбит, перегружаю питание.', 'Орудийный расчёт не отвечает.'],
    eng: ['Двигатель вышел из строя!', 'Тяга падает.', 'Теряем ход, помогите.'],
    fire_: ['Пожар в отсеке! Аварийная команда!', 'Горим! Герметизируйте переборки.', 'Разгерметизация, закрываем отсеки.'],
    dmg: ['Ремонтники работают.', 'Отсек восстановлен.', 'Аварийная бригада закончила, орудие снова в строю.'],
    power: ['Реактор встал! Переходим на аварийное питание!', 'Темно, всё обесточено!'],
    heat: ['Перегрев! Сбрасываю нагрузку.', 'Радиаторы не справляются.'],
    lost: ['Мы потеряли корабль… он взорвался.', 'Есть потери! Корабль уничтожен.', 'Прощайте, ребята. Держитесь.'],
    kill: ['Цель уничтожена!', 'Есть! Один готов.', 'Вражеский корабль разваливается.'],
    flee: ['Отступаем! Всем уходить из-под огня!', 'Это конец, выходим из боя.', 'Приказ: отход. Назад, назад!'],
    surr: ['Мы сдаёмся! Прекратите огонь!', 'Командир, кончайте, мы сдаёмся!'],
    board: ['Абордажная партия пошла.', 'Десант готов, стыкуемся.', 'Шлюз открыт, заходим.'],
    prize: ['Корабль захвачен, ведём как приз.', 'Захват завершён, экипаж сдался.'],
    fgt: ['Звено, на заход. Работаем по борту.', 'Истребители, атака!', 'Сбросили залп, выходим из зоны огня.', 'Пошли на второй заход.'],
    fgtl: ['Потеряли ведомого!', 'Борт, у нас потери в звене.'],
    jam: ['Помехи! Радар слепой.', 'Нас глушат, цель потеряна.', 'Связь рвётся, повторите.'],
    rock: ['Осторожно, обломки!', 'Скала по курсу, снаряд ушёл в камень.', 'Камни рядом, манёвр!'],
    order: ['Принято, выполняю.', 'Приказ понял.', 'Есть, меняем курс.'],
    win: ['Противник разбит.', 'Бой окончен. Мы выстояли.'],
    lose: ['Всё кончено…', 'Флот разбит.'],
  };
  let voices = null;
  const loadVoices = () => { try { voices = (speechSynthesis.getVoices() || []).filter(v => /^ru/i.test(v.lang)) } catch (e) { voices = [] } };
  const squelch = hi => { tone(.05, hi ? 1700 : 1300, hi ? 1700 : 1300, .05, 'square'); noise(.12, 2500, 1800, .05, 'bandpass', 2) };
  // radio(side, key, who): минимум одна реплика за раз, не чаще раза в 2.5 с, одинаковые типы — реже
  const radio = (side, key, who) => {
    if (!on || !L[key] || speaking) return;
    const n = performance.now(); if (n - lastV < 2500 || n - (lastLine[key] || 0) < 9000) return;
    if (!ctx()) return;
    lastV = n; lastLine[key] = n;
    const arr = L[key], txt = arr[(Math.random() * arr.length) | 0], name = who && who.T && who.T.n ? who.T.n : '';
    squelch(true);
    // фоновый шум эфира на время реплики
    noise(2.4, 3000, 2000, .02, 'bandpass', 1.5);
    try {
      if (!window.speechSynthesis) return;
      if (!voices) loadVoices();
      const u = new SpeechSynthesisUtterance((name && Math.random() < .5 ? name + ': ' : '') + txt);
      u.lang = 'ru-RU'; if (voices && voices.length) u.voice = voices[(side * 3 + ((Math.random() * voices.length) | 0)) % voices.length];
      u.rate = 1.05 + Math.random() * .25; u.pitch = side ? .75 + Math.random() * .3 : 1 + Math.random() * .3; u.volume = Math.min(1, vol * 1.3);
      speaking = true; u.onend = u.onerror = () => { speaking = false; squelch(false) };
      setTimeout(() => { speaking = false }, 6000);
      speechSynthesis.speak(u);
    } catch (e) { speaking = false }
  };
  try { if (window.speechSynthesis) speechSynthesis.onvoiceschanged = loadVoices } catch (e) {}
  return {
    shot, boom, radio,
    setOn(v) { on = !!v; if (!on) { try { speechSynthesis.cancel() } catch (e) {} } else ctx() && ac.state === 'suspended' && ac.resume() },
    isOn: () => on,
    setVol(v) { vol = v; if (master) master.gain.value = v },
    unlock() { const a = ctx(); if (a && a.state === 'suspended') a.resume() },
    stop() { try { speechSynthesis.cancel() } catch (e) {} speaking = false },
  };
})();
