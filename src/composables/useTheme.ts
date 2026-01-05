import { ref, watch, onMounted } from 'vue';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'lumen-theme';

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
    console.log('[Theme] Applied system mode (blue theme)');
  } else if (theme.value === 'dark') {
    // Dark mode uses dark green/lime theme
    root.classList.add('dark');
    effectiveTheme.value = 'dark';
    console.log('[Theme] Applied dark mode (green/lime theme)');
  } else {
    // Light mode uses light green/lime theme (no class needed - default)
    effectiveTheme.value = 'light';
    console.log('[Theme] Applied light mode (green/lime theme)');
  }
  console.log('[Theme] Root classes:', root.className);
}

function setTheme(newTheme: Theme) {
  console.log('[Theme] Setting theme to:', newTheme);
  theme.value = newTheme;
  localStorage.setItem(STORAGE_KEY, newTheme);
  updateEffectiveTheme();
}

function initTheme() {
  // Load saved theme or default to 'light'
  const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (saved && ['light', 'dark', 'system'].includes(saved)) {
    theme.value = saved;
  }
  
  // Get system preference
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
