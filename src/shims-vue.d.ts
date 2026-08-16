/**
 * Lets `tsc --noEmit` resolve `.vue` imports.
 *
 * Without this every `import X from './X.vue'` is a TS2307 error, which drowns
 * the real findings and is why type-checking was never wired up here. Note this
 * only makes the import resolvable — the component's own props and template are
 * NOT checked (that would need `vue-tsc`, a separate step).
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, any>;
  export default component;
}
