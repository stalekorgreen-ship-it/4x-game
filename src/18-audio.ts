// @ts-nocheck
/* ===== ЗВУК БОЯ: синтез выстрелов/взрывов и радиопереговоры пилотов ===== */
export const Sfx = (() => {
  let ac = null, rev = null, revSend = null, master = null, on = true, vol = .5, noiseBuf = null, lastV = 0, speaking = false, lastLine = {};
  const lim = {}; // ограничение частоты по типам звуков
  const ctx = () => {
    if (ac) return ac;
    try {
      const A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
      ac = new A(); master = ac.createGain(); master.gain.value = vol;
      const cmp = ac.createDynamicsCompressor(); master.connect(cmp); cmp.connect(ac.destination);
      { const n = Math.floor(ac.sampleRate * 2.2), ir = ac.createBuffer(2, n, ac.sampleRate); for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.4) }
        rev = ac.createConvolver(); rev.buffer = ir; revSend = ac.createGain(); revSend.gain.value = .55; revSend.connect(rev); rev.connect(master) }
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null }
    return ac;
  };
  const ok = (key, ms) => { const n = performance.now(); if (n - (lim[key] || 0) < ms) return false; lim[key] = n; return true };
  // вывод звука: случайная панорама + отправка в «ангарную» реверберацию (хвост выстрела и взрыва)
  const route = (node, wet, pan) => {
    const a = ac; let n = node;
    if (a.createStereoPanner) { const p = a.createStereoPanner(); p.pan.value = pan != null ? pan : Math.random() * 1.2 - .6; n.connect(p); n = p }
    n.connect(master);
    if (wet > 0 && revSend) { const w = a.createGain(); w.gain.value = wet; n.connect(w); w.connect(revSend) }
  };
  const noise = (dur, f0, f1, g0, type = 'bandpass', q = 1, wet = .15, delay = 0) => {
    const a = ctx(); if (!a || !on) return;
    const t0 = a.currentTime + delay, s = a.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.loopStart = Math.random() * .5;
    const f = a.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    const g = a.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(g0, t0 + Math.min(.006, dur * .2)); g.gain.exponentialRampToValueAtTime(.0008, t0 + dur);
    s.connect(f); f.connect(g); route(g, wet); s.start(t0, Math.random() * .5); s.stop(t0 + dur + .05);
  };
  const tone = (dur, f0, f1, g0, type = 'sine', wet = .1, delay = 0, drive = 0) => {
    const a = ctx(); if (!a || !on) return;
    const t0 = a.currentTime + delay, o = a.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = a.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(g0, t0 + .004); g.gain.exponentialRampToValueAtTime(.0008, t0 + dur);
    let n = o;
    if (drive) { const ws = a.createWaveShaper(), c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * drive) } ws.curve = c; o.connect(ws); n = ws }
    n.connect(g); route(g, wet); o.start(t0); o.stop(t0 + dur + .05);
  };
  const shot = kind => {
    if (!on || !ok('s' + kind, kind === 'rail' ? 80 : kind === 'gat' ? 100 : 160)) return;
    const v = 1 + (Math.random() - .5) * .18;
    if (kind === 'rail') { // выстрел рельсотрона: сухой щелчок → резкий хлопок → гулкое тело → хвост эха
      noise(.012, 7000, 3500, .28, 'highpass', .7, 0);
      noise(.09, 3400 * v, 500, .3, 'bandpass', .9, .3);
      tone(.22, 250 * v, 46, .36, 'sine', .25, 0, 2.2); tone(.13, 125 * v, 38, .24, 'triangle', .2);
      noise(.2, 420, 60, .24, 'lowpass', .7, .35);
      noise(.65, 1000, 140, .06, 'lowpass', .5, .7, .03);
    } else if (kind === 'gat') { // Гатлинг: быстрая очередь коротких сухих выстрелов
      for (let i = 0; i < 4; i++) { const d = i * .026 + Math.random() * .008, w = 1 + (Math.random() - .5) * .25;
        noise(.008, 6500, 3000, .14, 'highpass', .7, 0, d); noise(.055, 2400 * w, 380, .15, 'bandpass', 1.1, .18, d); tone(.05, 190 * w, 70, .13, 'square', .1, d, 1.5) }
    } else if (kind === 'laser') { // лазер: нарастающий визг зарядки и звонкий «зап» с затухающим кольцом
      tone(.32, 380, 1700, .06, 'sawtooth', .2);
      tone(.5, 2600, 170, .15, 'sawtooth', .5, .3, 1.4); tone(.42, 5200, 700, .05, 'square', .5, .3); noise(.34, 6500, 900, .09, 'bandpass', 3, .5, .3); tone(.9, 880, 860, .03, 'sine', .8, .32);
    } else if (kind === 'missile') { // пуск ракеты: хлопок катапульты и шипящий шлейф
      tone(.14, 190, 55, .26, 'triangle', .25, 0, 2); noise(.04, 4200, 1500, .16, 'bandpass', .8, .1);
      noise(1.2, 280, 2600, .15, 'bandpass', .7, .45, .04); noise(1.0, 5200, 3200, .03, 'highpass', .6, .3, .06); tone(.7, 85, 52, .1, 'sawtooth', .3, .04);
    } else if (kind === 'flak') { // зенитка: короткая сухая очередь
      noise(.01, 7000, 3000, .2, 'highpass', .7, 0); noise(.06, 2800 * v, 550, .15, 'bandpass', 1, .2); tone(.07, 330, 95, .14, 'square', .1, 0, 1.6);
    }
  };
  const boom = size => {
    if (!on || !ok('b', size > 10 ? 150 : 70)) return;
    const k = Math.min(1, size / 30), d = Math.min(3, .55 + size * .06), g = Math.min(.5, .14 + size * .014);
    noise(.05, 4200, 900, g * .8, 'bandpass', .8, .2); // фронт взрыва
    tone(d, 80 + 30 * (1 - k), 21, g * 1.1, 'sine', .35, 0, 2.5); // низкий удар
    noise(d * 1.3, 650, 45, g, 'lowpass', .5, .6); // грохот
    if (size >= 6) noise(d * 1.8, 420, 70, g * .35, 'lowpass', .5, .85, .12);
    for (let i = 0, n = Math.min(10, Math.round(size / 3)); i < n; i++) noise(.03 + Math.random() * .03, 2400 + Math.random() * 2500, 500, .05 + .05 * Math.random(), 'bandpass', 1.2, .25, .12 + i * .07 * (.4 + Math.random())); // летящие обломки
    if (size >= 20) { tone(d, 58, 20, g * .9, 'sine', .4, .3, 2); noise(d * 1.5, 520, 50, g * .7, 'lowpass', .5, .7, .3) }
  };
  /* --- двигатели: непрерывный гул (низкий саунд + турбулентный шум), растёт с тягой флота и форсажем --- */
  let eng = null;
  const engine = (level, boost) => {
    return; // звук двигателей отключён по просьбе игрока
    const a = ctx(); if (!a) return;
    if (!eng) {
      if (level <= 0 || !on) return;
      const mix = a.createGain(), lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140; lp.Q.value = .8; mix.connect(lp);
      const o1 = a.createOscillator(), o2 = a.createOscillator(), o3 = a.createOscillator(); o1.type = 'sawtooth'; o2.type = 'sawtooth'; o3.type = 'triangle';
      o1.frequency.value = 44; o2.frequency.value = 46.5; o3.frequency.value = 88; for (const o of [o1, o2, o3]) { o.connect(mix); o.start() }
      const lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = 6.5; lg.gain.value = 6; lfo.connect(lg); lg.connect(o1.frequency); lfo.start();
      const g = a.createGain(); g.gain.value = 0; lp.connect(g); g.connect(master);
      const ns = a.createBufferSource(); ns.buffer = noiseBuf; ns.loop = true; const nf = a.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 240; nf.Q.value = .7; const ng = a.createGain(); ng.gain.value = 0; ns.connect(nf); nf.connect(ng); ng.connect(master); ns.start();
      eng = { o1, o2, o3, lp, g, nf, ng };
    }
    const t = a.currentTime, L = on ? Math.max(0, Math.min(1, level)) : 0, B = Math.max(0, Math.min(1, boost || 0));
    eng.g.gain.setTargetAtTime(L * .17 + B * .05, t, .3); eng.lp.frequency.setTargetAtTime(110 + L * 240 + B * 260, t, .3);
    eng.o1.frequency.setTargetAtTime(42 + L * 22 + B * 16, t, .4); eng.o2.frequency.setTargetAtTime(44.5 + L * 23 + B * 17, t, .4); eng.o3.frequency.setTargetAtTime(84 + L * 42 + B * 30, t, .4);
    eng.ng.gain.setTargetAtTime(L * .1 + B * .12, t, .3); eng.nf.frequency.setTargetAtTime(200 + L * 280 + B * 500, t, .3);
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
  const squelch = hi => { tone(.05, hi ? 1700 : 1300, hi ? 1700 : 1300, .05, 'square'); noise(.12, 2500, 1800, .05, 'bandpass', 2) };
  // голосовой связи нет: озвучка браузера звучит плохо, живые голоса — позже
  const radio = () => {};
  return {
    shot, boom, radio, engine,
    setOn(v) { on = !!v; if (!on) { engine(0, 0) } else ctx() && ac.state === 'suspended' && ac.resume() },
    isOn: () => on,
    setVol(v) { vol = v; if (master) master.gain.value = v },
    unlock() { const a = ctx(); if (a && a.state === 'suspended') a.resume() },
    stop() { speaking = false },
  };
})();
