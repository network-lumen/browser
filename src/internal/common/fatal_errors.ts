import { t } from '../../stores/i18nStore';
import { markForTranslation } from '../services/i18n';
import { useInternalLumen } from '../../composables/useInternalLumen';
import {
  REQUIRED_FUNCTIONS,
  REQUIRED_NAMESPACES,
  REQUIRED_VALUES
} from './lumenBridgeSurface';

/**
 * Startup smoke check of the preload bridge.
 *
 * If `window.lumen` is missing or incomplete, every feature in the app breaks
 * at once, usually with an unhelpful error deep inside whatever page the user
 * happened to open. This runs once from App.vue's onMounted and fails loudly
 * with a support link instead.
 *
 * The lists below mirror `electron/preloads/preload.cjs` exactly.
 * `tests/unit/fatal-errors-coverage.test.ts` re-derives them from that file and
 * fails if the two drift, so a preload method removed without updating this
 * list breaks CI rather than the user's startup.
 */

// The constant is marked, not translated: this table is built at module load,
// long before a profile's locale is read, so t() here would pin it to English.
// App.vue translates it where it draws the error.
const FATAL_ERROR_MAP: Record<string, string | ((name: string) => string)> = {
  FATAL000001: markForTranslation('Lumen API not found'),
  FATAL000002: (name: string) => t('Missing API namespace {name}', { name }),
  FATAL000004: (name: string) => t('Missing function {name}', { name })
};

const missingNamespace = (name: string) =>
  (FATAL_ERROR_MAP.FATAL000002 as (n: string) => string)(name);
const missingMember = (name: string) =>
  (FATAL_ERROR_MAP.FATAL000004 as (n: string) => string)(name);

/**
 * Throws on the first missing entry. The bridge is read here rather than at
 * module load, so the check does not depend on import order.
 */
async function checkLumenAPIReferences(): Promise<void> {
  const lumen: any = useInternalLumen();
  if (!lumen) throw new Error('FATAL000001');

  for (const name of REQUIRED_VALUES) {
    if (!(name in lumen)) throw new Error(missingMember(name));
  }

  for (const name of REQUIRED_FUNCTIONS) {
    if (typeof lumen[name] !== 'function') throw new Error(missingMember(name));
  }

  for (const [namespace, members] of Object.entries(REQUIRED_NAMESPACES)) {
    const group = lumen[namespace];
    if (!group || typeof group !== 'object') throw new Error(missingNamespace(namespace));
    for (const member of members) {
      if (typeof group[member] !== 'function') {
        throw new Error(missingMember(`${namespace}.${member}`));
      }
    }
  }
}

export {
  checkLumenAPIReferences,
  FATAL_ERROR_MAP
};
