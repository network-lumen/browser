/** Anything the app might hold a point in time as: ms/seconds epoch, ISO string, or a Date. */
export type DateInput = number | string | Date | null | undefined;

export interface FormatDateOptions {
  /** Rendered when the input is empty or unparseable. */
  empty?: string;
  /** BCP-47 tag passed to `toLocaleString`. */
  locale?: string;
  /** Merged over the formatter's defaults. */
  intl?: Intl.DateTimeFormatOptions;
}

export interface FormatNumberOptions {
  empty?: string;
  locale?: string;
  intl?: Intl.NumberFormatOptions;
}

export interface FormatBytesOptions {
  /** Decimals used above the byte unit (bytes themselves are always integers). */
  decimals?: number;
  empty?: string;
}

export interface FormatDecimalOptions {
  decimals?: number;
  /** `1.500000` -> `1.5`. */
  trimTrailingZeros?: boolean;
  empty?: string;
}

export interface FormatDenomOptions {
  /** Uppercase denoms that carry no `u` micro prefix instead of leaving them untouched. */
  uppercaseFallback?: boolean;
}

export interface TruncateMiddleOptions {
  /** Characters kept at the head. */
  start?: number;
  /** Characters kept at the tail. */
  end?: number;
  separator?: string;
  empty?: string;
}
