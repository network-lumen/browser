// Deliberately minimal: only the 5 rules below, chosen because they have a
// real AST behind them (unlike scripts/check-conventions.mjs's regex-based
// checks) and each one caught an actual bug found by hand this session:
//   - no-console          -> 8 debug console.log()s left in SettingsPage.vue
//   - no-empty-function   -> DrivePage.vue's handleDrop(e) { } (wired to a
//                            real addEventListener, did nothing on drop)
//   - no-unreachable      -> DrivePage.vue's downloadFile() had ~17 lines of
//                            .tar download code after an unconditional return
//   - no-unused-vars      -> superset of check-conventions.mjs's regex-based
//                            unused-import/declaration rules, but AST-backed
//   - vue/valid-v-on      -> SearchPage.vue's @keydown.slash.prevent used a
//                            modifier Vue doesn't support (key modifiers
//                            match event.key, and "/" produces key === "/",
//                            not "Slash") - the shortcut silently never fired
// Not a general "eslint:recommended" sweep on purpose - that would surface a
// wave of unrelated pre-existing findings across ~90 files with no bearing
// on this cleanup pass. The project's own CSS-utility-system rules (dead/
// undefined classes, cascade conflicts, no raw <svg>, etc.) have no generic
// linter equivalent and stay in scripts/check-conventions.mjs.
import vuePlugin from 'eslint-plugin-vue';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'release/**', 'public/**'] },
  ...vuePlugin.configs['flat/base'],
  {
    files: ['src/**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
      },
    },
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
    },
  },
  {
    files: ['src/**/*.vue', 'src/**/*.ts'],
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      // arrowFunctions allowed: `.catch(() => {})` to deliberately swallow a
      // rejection (e.g. autoplay-blocked video.play()) is idiomatic here and
      // used 6x already. Named `function foo() {}` stubs (the real bug this
      // rule caught - DrivePage's dead handleDrop) are still flagged.
      'no-empty-function': ['error', { allow: ['arrowFunctions'] }],
      'no-unreachable': 'error',
      'vue/valid-v-on': 'error',
      'no-unused-vars': 'off',
      // Respects this codebase's existing "leading underscore = intentionally
      // unused" convention (already used in several files before this rule
      // existed, e.g. `catch (_e)`, `(_releases, _tag)`).
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
];
