import { installLogCapture } from './appLog';

/**
 * Starts log capture as a side effect of being imported.
 *
 * Calling `installLogCapture()` from `src/main.ts` is too late, and the reason
 * is the same one that broke `upload.ts` earlier: ES modules evaluate every
 * import before the importing module's body. The platform bridge installs
 * itself that way too - and it starts the IPFS node while doing it - so every
 * line it logged happened before the capture existed and was simply lost.
 *
 * Which is why the log screen stayed empty while the node was failing, and why
 * this file exists rather than one more call in main.ts: a module's position in
 * the import list is the only ordering guarantee available here.
 *
 * It must stay the FIRST import in main.ts.
 */
installLogCapture();
