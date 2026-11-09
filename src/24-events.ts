// @ts-nocheck
// ===== Ивенты в стиле Paradox: заготовка =====
// Ивент = условие + среднее время до срабатывания (MTTH) + текст + варианты ответа с последствиями.
// Раз в месяц игры evTick проверяет все ивенты; сработавший ставит игру на паузу и показывает окно с выбором.
// Как добавить ивент: допиши объект в EVENTS (формат ниже). Флаги (setFlag/hasFlag) связывают ивенты в цепочки.
import { state, log } from './01-data.ts';
import { eventArt } from './17-art.ts';

export const year = () => 2030 + (state.t || 0) / 360;
export const hasFlag = k => !!(state.evFlags && state.evFlags[k]);
export const setFlag = (k, v = true) => { (state.evFlags = state.evFlags || {})[k] = v; };
const earth = () => state.cols && state.cols.earth && state.cols.earth.pop;

/* Формат ивента:
 { id: 'уникальный_id',
   title: 'Заголовок', art: 'crisis' | 'raid' | 'discovery' | 'colony' | 'money' | ... (картинка из 17-art),
   text: 'Текст' или () => 'текст с цифрами из игры',
   once: true,                       // сработать один раз за игру (иначе — повторяемый, с паузой cooldown дней)
   cooldown: 3600,
   trigger: () => условие,           // когда ивент вообще возможен
   mtth: 360,                        // в среднем через сколько дней сработает, когда условие выполнено (0 — сразу)
   options: [{ text: 'Вариант', hint: 'что будет', effect: () => { ... } }] } */
export const EVENTS = [
  { id: 'low_birth', title: 'Рождаемость ниже замещения', art: 'crisis', once: true, mtth: 180,
    trigger: () => { const P = earth(); return P && P.birth > 0 && P.birth < P.death; },
    text: () => 'Впервые за историю на Земле умирает больше людей, чем рождается. Демографы говорят, что это надолго: рабочих рук станет меньше, пенсионеров — больше.',
    options: [
      { text: 'Поддержать семьи', hint: 'Пример: поднять пособия (заглушка)', effect: () => { setFlag('fam_support'); } },
      { text: 'Делать ставку на автоматизацию', hint: 'Пример: открыть цепочку про роботов (заглушка)', effect: () => { setFlag('automation_path'); } },
    ] },
  { id: 'first_pirates', title: 'Пираты в поясе', art: 'raid', once: true, mtth: 720,
    trigger: () => hasFlag('space_mining_boom'), // флаг выставит экономика, когда добыча в космосе станет очень выгодной
    text: 'Грузовик «Вега Майнинг» не вышел на связь. Обломки нашли у Цереры, груз пропал. В отрасли шепчутся, что это конкуренты.',
    options: [
      { text: 'Отправить флот', hint: 'Первые бои с пиратами (заглушка)', effect: () => { setFlag('anti_piracy'); } },
      { text: 'Это дело корпораций', hint: 'Корпорации начнут уходить из космоса (заглушка)', effect: () => { setFlag('ignore_piracy'); } },
    ] },
  { id: 'generation_ship', title: 'Корабль поколений', art: 'discovery', once: true, mtth: 0,
    trigger: () => year() >= 2150,
    text: 'Телескопы засекли объект массой около десяти миллионов тонн, тормозящий на подлёте к Солнечной системе. Он летел сюда двести тысяч лет.',
    options: [{ text: 'Готовиться', hint: 'Начало эндшпиля демо (заглушка)', effect: () => { setFlag('endgame'); } }] },
];

let open = null;
export function evTick(dt) {
  if (open) return; const st = state; st.evDone = st.evDone || {};
  for (const e of EVENTS) {
    const last = st.evDone[e.id]; if (last != null && (e.once || st.t - last < (e.cooldown || 3600))) continue;
    let ok = false; try { ok = e.trigger(); } catch (x) { ok = false; }
    if (!ok) continue;
    if (e.mtth > 0 && Math.random() >= 1 - Math.exp(-dt / e.mtth)) continue;
    fire(e); return;
  }
}
export function fire(e) {
  state.evDone = state.evDone || {}; state.evDone[e.id] = state.t;
  const text = typeof e.text === 'function' ? e.text() : e.text; log(`Событие: ${e.title}.`);
  if (typeof document === 'undefined' || !document.body || !document.createElement) { e.options[0].effect(); return; } // без интерфейса (тесты) — первый вариант
  try {
    const was = state.paused; state.paused = true; open = e;
    const d = document.createElement('div'); d.id = 'ev-modal';
    d.style.cssText = 'position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center';
    d.innerHTML = `<div style="width:min(520px,92vw);background:#121a26;border:1px solid #3a4a62;border-radius:10px;padding:14px;color:#dbe4f0;font:14px/1.45 system-ui,sans-serif">${eventArt(e.art || 'crisis', 492, 150)}<h2 style="margin:10px 0 6px;font-size:18px"></h2><p style="margin:0 0 12px"></p><div class="opts" style="display:flex;flex-direction:column;gap:6px"></div></div>`;
    d.querySelector('h2').textContent = e.title; d.querySelector('p').textContent = text;
    const box = d.querySelector('.opts');
    e.options.forEach(o => { const b = document.createElement('button'); b.className = 'btn'; b.style.textAlign = 'left'; b.innerHTML = `<b></b>${o.hint ? '<br><span class="muted" style="font-size:12px"></span>' : ''}`; b.querySelector('b').textContent = o.text; if (o.hint) b.querySelector('span').textContent = o.hint;
      b.onclick = () => { try { o.effect(); } catch (x) { console.error(x); } log(`Решение: ${o.text}.`); d.remove(); open = null; state.paused = was; }; box.appendChild(b); });
    document.body.appendChild(d);
  } catch (x) { open = null; }
}
