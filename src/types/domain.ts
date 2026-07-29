export type DomainTarget = {
  proto: 'ipfs' | 'ipns';
  id: string;
  /**
   * Optional sub-path inside the target root. Allows domain records like:
   * `lumen://ipfs/<cid>/some/subdir/`
   * so the domain root maps to that subdir.
   *
   * Normalized form: '' (none) or '/path/without/trailing/slash'.
   */
  basePath?: string;
  suffix?: string;
};

export type ResolverRecord = { key: string; value: string };
