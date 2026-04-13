// Small framework-agnostic helpers shared across layers.
export const toSortedPair = (a: string, b: string): [string, string] =>
  a < b ? [a, b] : [b, a];

export const isDefined = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;
