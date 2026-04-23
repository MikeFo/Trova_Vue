import { computed, ref } from 'vue';

type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'trova.theme';
const prefersDarkMql = window.matchMedia?.('(prefers-color-scheme: dark)') ?? null;

const preference = ref<ThemePreference>('system');
const isDark = ref<boolean>(false);

function readStoredPreference(): ThemePreference {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // ignore
  }
  return 'system';
}

function writeStoredPreference(value: ThemePreference) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // ignore
  }
}

function applyDarkClass(enabled: boolean) {
  const root = document.documentElement;
  root.classList.toggle('dark', enabled);
  // Helps native form controls pick correct palette where supported.
  root.style.colorScheme = enabled ? 'dark' : 'light';
}

function computeIsDark(pref: ThemePreference): boolean {
  if (pref === 'dark') return true;
  if (pref === 'light') return false;
  return prefersDarkMql?.matches ?? false;
}

function applyTheme(pref: ThemePreference) {
  isDark.value = computeIsDark(pref);
  applyDarkClass(isDark.value);
}

function setPreference(next: ThemePreference) {
  preference.value = next;
  writeStoredPreference(next);
  applyTheme(next);
}

function setDark(enabled: boolean) {
  setPreference(enabled ? 'dark' : 'light');
}

function initTheme() {
  const stored = readStoredPreference();
  preference.value = stored;
  applyTheme(stored);
}

function handleSystemThemeChange() {
  if (preference.value !== 'system') return;
  applyTheme('system');
}

prefersDarkMql?.addEventListener?.('change', handleSystemThemeChange);

export function useTheme() {
  return {
    preference: computed(() => preference.value),
    isDark: computed(() => isDark.value),
    initTheme,
    setPreference,
    setDark,
  };
}

