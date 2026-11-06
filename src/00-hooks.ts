// @ts-nocheck
// Поздняя привязка функций, чтобы модули не зависели друг от друга по кругу.
export const hooks: Record<string, (...a: any[]) => any> = {};
