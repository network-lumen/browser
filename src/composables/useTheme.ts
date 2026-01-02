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
  if (theme.value === 'system') {
    effectiveTheme.value = systemPrefersDark.value ? 'dark' : 'light';
  } else {
    effectiveTheme.value = theme.value;
  }
  
  // Apply theme to document
  if (effectiveTheme.value === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

function setTheme(newTheme: Theme) {
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
  onMounted(() => {
    if (theme.value === 'light' && !localStorage.getItem(STORAGE_KEY)) {
      initTheme();
    }
  });
  
  return {
    theme,
    effectiveTheme,
    setTheme,
    initTheme
  };
}
