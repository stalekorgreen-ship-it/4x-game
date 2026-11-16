// @ts-nocheck
// Поток расчётов ИИ: загружает чистое ядро оценки (05w-ai-kernel.ts) и считает пакет оценок урона по запросу.
// Проверка переносимости ядра в Worker: результат обязан совпадать с главным потоком бит в бит (tools/worker-test.cjs).
import { initKernel, dpsAt, dpsAt3 } from './05w-ai-kernel.ts';
onmessage = (e) => { const m = e.data; if (m.init) { initKernel(m.init); postMessage({ ok: 1 }); return }
  if (m.batch) { const t0 = performance.now(), out = new Float64Array(m.batch.length); for (let i = 0; i < m.batch.length; i++) { const q = m.batch[i]; out[i] = q.k3 ? dpsAt3(q.ws, q.X, q.d, q.asp) : dpsAt(q.ws, q.o, q.d, q.asp, q.wpN) } postMessage({ out, ms: performance.now() - t0 }, [out.buffer]) } };
