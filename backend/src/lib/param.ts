/**
 * Express 5 / @types/express: route params may be `string | string[]`.
 */
export function singleRouteParam(p: string | string[] | undefined): string {
  if (p == null) return "";
  return Array.isArray(p) ? p[0]! : p;
}
