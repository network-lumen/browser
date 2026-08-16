import { ref } from 'vue';
import type { NavBarImportMode } from '../types/navBar';

/**
 * A request from anywhere in the app to open the profile import dialog.
 *
 * The dialog belongs to the navbar's profile menu, which is not an ancestor of
 * the pages that need it - a page cannot reach it by prop or by inject. This
 * is the one shared fact between them: a counter the menu watches, and the
 * mode the requester wants the dialog opened on.
 *
 * A counter rather than a boolean, so asking twice in a row opens it twice
 * rather than being swallowed as "already true".
 */
export const importRequest = ref(0);

/** Which tab the dialog should land on when it opens. */
export const importRequestMode = ref<NavBarImportMode>('file');

/**
 * Asks the navbar to open the import dialog.
 *
 * Defaults to the recovery-phrase tab: every caller so far is offering to
 * import a phrase specifically, and landing on the file picker would make them
 * click again to reach what they asked for.
 */
export function requestProfileImport(mode: NavBarImportMode = 'manual') {
  importRequestMode.value = mode;
  importRequest.value += 1;
}
