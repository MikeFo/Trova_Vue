/**
 * Dev-only logging so production consoles stay readable (errors surface first).
 * Use console.error / console.warn only for issues that should appear in prod builds.
 */

const isDev = import.meta.env.DEV;

export const devLog = (...args: unknown[]): void => {
  if (isDev) console.log(...args);
};

export const devWarn = (...args: unknown[]): void => {
  if (isDev) console.warn(...args);
};
