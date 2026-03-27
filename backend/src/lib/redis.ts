import { Redis } from "ioredis";
import { getConfig } from "../config.js";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    const { REDIS_URL } = getConfig();
    client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
  }
  return client;
}
