// Deliberately minimal: only the rules below, chosen because they have a
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
//   - no-restricted-syntax (TSInterfaceDeclaration/TSTypeAliasDeclaration)
//                         -> enforces the src/types/ centralization convention
//                            (see CONTRIBUTING.md) - added 2026-07-29 after a
//                            real DriveFile interface had silently drifted
//                            into 3 separate copies across the codebase.
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
  {
    // The main process was linted by nothing at all until a cleanup pass here
    // deleted a function and left three calls to it - a ReferenceError on
    // `extensions:disable`, in a file that `npm test` never opens. `no-undef`
    // is the whole point of this block; the other two come free.
    //
    // Deliberately narrower than the src rules: no-console is off (the main
    // process logs to a real log file on purpose) and unused vars are a
    // warning, because a preload that keeps a reference for clarity is not a
    // bug worth failing a build over.
    files: ['electron/**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        // Node, plus what a preload sees: it runs in a renderer, so it has
        // both halves.
        require: 'readonly', module: 'writable', exports: 'writable',
        process: 'readonly', console: 'readonly', Buffer: 'readonly',
        __dirname: 'readonly', __filename: 'readonly', global: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly',
        setInterval: 'readonly', clearInterval: 'readonly',
        setImmediate: 'readonly', queueMicrotask: 'readonly',
        URL: 'readonly', URLSearchParams: 'readonly', TextEncoder: 'readonly',
        TextDecoder: 'readonly', AbortController: 'readonly', fetch: 'readonly',
        Headers: 'readonly', Request: 'readonly', Response: 'readonly',
        Blob: 'readonly', FormData: 'readonly', File: 'readonly',
        ReadableStream: 'readonly', WritableStream: 'readonly',
        TransformStream: 'readonly', structuredClone: 'readonly',
        performance: 'readonly', crypto: 'readonly', btoa: 'readonly',
        atob: 'readonly', Event: 'readonly', EventTarget: 'readonly',
        CustomEvent: 'readonly', MessageChannel: 'readonly',
        window: 'readonly', document: 'readonly', navigator: 'readonly',
        location: 'readonly', history: 'readonly', BroadcastChannel: 'readonly',
        localStorage: 'readonly', sessionStorage: 'readonly',
        XMLHttpRequest: 'readonly', WebSocket: 'readonly', Image: 'readonly',
        MutationObserver: 'readonly', requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly', getComputedStyle: 'readonly',
        Node: 'readonly', Element: 'readonly', HTMLElement: 'readonly',
        DOMParser: 'readonly', Worker: 'readonly', importScripts: 'readonly',
        self: 'readonly', chrome: 'readonly', browser: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-unused-vars': ['warn', {
        args: 'none',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],
    },
  },
  {
    // Every type/interface declaration must live in src/types/ (one file per
    // concept/page, see CONTRIBUTING.md) - single source of truth, no
    // colocated ad hoc types drifting out of sync across files. This is the
    // TS-side equivalent of "all CSS lives in src/css/": a project-wide rule
    // contributors can follow without having to judge case-by-case whether a
    // given type is "shared enough" to deserve centralizing.
    files: ['src/**/*.vue', 'src/**/*.ts'],
    ignores: ['src/types/**'],
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'no-restricted-syntax': ['error',
        {
          selector: 'TSInterfaceDeclaration',
          message: 'Interfaces must live in src/types/<concept>.ts, not colocated with implementation. See CONTRIBUTING.md.',
        },
        {
          selector: 'TSTypeAliasDeclaration',
          message: 'Type aliases must live in src/types/<concept>.ts, not colocated with implementation. See CONTRIBUTING.md.',
        },
      ],
    },
  },
];
