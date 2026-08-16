import { ref } from 'vue';
import type { Theme } from '../types/theme';
import { STORAGE_KEYS, readString, writeString } from '../internal/services/storage';

export type { Theme };

const theme = ref<Theme>('light');
const effectiveTheme = ref<'light' | 'dark'>('light');

// System dark mode preference
const systemPrefersDark = ref(false);

function getSystemPreference(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function updateEffectiveTheme() {
  const root = document.documentElement;
  
  // Remove all theme classes first
  root.classList.remove('dark', 'system');
  
  if (theme.value === 'system') {
    // System mode uses original blue theme
    root.classList.add('system');
    effectiveTheme.value = systemPrefersDark.value ? 'dark' : 'light';
  } else if (theme.value === 'dark') {
    // Dark mode uses dark green/lime theme
    root.classList.add('dark');
    effectiveTheme.value = 'dark';
  } else {
    // Light mode uses light green/lime theme (no class needed - default)
    effectiveTheme.value = 'light';
  }
}

function setTheme(newTheme: Theme) {
  theme.value = newTheme;
  writeString(STORAGE_KEYS.theme, newTheme);
  updateEffectiveTheme();
}

function initTheme() {
  // Load saved theme or default to 'light'
  const saved = readString(STORAGE_KEYS.theme) as Theme | null;
  if (saved && ['light', 'dark', 'system'].includes(saved)) {
    theme.value = saved;
  }
  
  systemPrefersDark.value = getSystemPreference();
  
  // Listen to system theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleChange = (e: MediaQueryListEvent) => {
    systemPrefersDark.value = e.matches;
    updateEffectiveTheme();
  };
  
  mediaQuery.addEventListener('change', handleChange);
  
  // Initial update
  updateEffectiveTheme();
}

export function useTheme() {
  return {
    theme,
    effectiveTheme,
    setTheme,
    initTheme
  };
}
