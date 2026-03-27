export function formatCoins(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
