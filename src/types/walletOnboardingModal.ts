/**
 * `language` comes first and only on a machine that has never answered: every
 * profile made afterwards inherits the language of the one it was made from, so
 * the question is asked once, not once per profile.
 */
export type OnboardingStep =
  | 'language'
  | 'intro'
  | 'password'
  | 'profile-name'
  | 'creating-wallet'
  | 'backup'
  | 'complete';
