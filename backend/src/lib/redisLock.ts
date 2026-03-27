import crypto from "node:crypto";
import { getRedis } from "./redis.js";

export async function withLock<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T | null> {
  const r = getRedis();
  const token = crypto.randomUUID();
  const ok = await r.set(`lock:${key}`, token, "EX", ttlSec, "NX");
  if (ok !== "OK") return null;
  try {
    return await fn();
  } finally {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end`;
    await r.eval(script, 1, `lock:${key}`, token);
  }
}
