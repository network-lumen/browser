/**
 * One recognised chain refusal.
 *
 * `match` is a lowercased fragment of the module's own message, deliberately
 * not translated: it is compared against what the chain sends, which is always
 * English. `message` is a function so it reads the active locale when the
 * refusal happens rather than when the table is built.
 */
export type ChainErrorRule = {
  match: string;
  message: () => string;
};
