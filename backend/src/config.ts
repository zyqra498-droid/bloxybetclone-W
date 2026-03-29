import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

// Monorepo: .env often lives at repo root while cwd is `backend/`
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  APP_URL: z.string().url(),
  FRONTEND_URL: z.string().url().optional(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SEC: z.coerce.number().default(900),
  JWT_REFRESH_TTL_SEC: z.coerce.number().default(60 * 60 * 24 * 30),
  ENCRYPTION_KEY: z.string().min(32),
  TRADE_HMAC_SECRET: z.string().min(16),
  /** Bio verification: pending challenge TTL (seconds). */
  BIO_CHALLENGE_TTL_SEC: z.coerce.number().default(900),
  /** Pending deposit/withdraw trade must complete within this window (seconds). */
  TRADE_SESSION_TTL_SEC: z.coerce.number().default(2700),
  CSRF_SECRET: z.string().min(32),
  HOUSE_TAX_PERCENT: z.coerce.number().default(5),
  JACKPOT_MIN_DEPOSIT: z.coerce.number().default(50),
  COINFLIP_MIN_VALUE: z.coerce.number().default(100),
  COINFLIP_ROOM_MINUTES: z.coerce.number().default(5),
  JACKPOT_ROUND_SECONDS: z.coerce.number().default(120),
  JACKPOT_MAX_POT: z.coerce.number().default(1_000_000),
  BLOCK_VPN: z.coerce.boolean().default(false),
  MOCK_ROBLOX_TRADES: z.coerce.boolean().default(false),
  /**
   * When true, POST /api/inventory/catalog-deposit credits a catalog item without a Roblox trade.
   * With MOCK_ROBLOX_TRADES=false, each row needs a numeric Roblox limited id (robloxCatalogAssetId or numeric robloxAssetId) so withdrawals can send that item from the bot.
   */
  CATALOG_INSTANT_DEPOSIT: z.coerce.boolean().default(true),
  /**
   * Optional: Roblox trade bot session. On API startup, syncs into `bots` (create or update by username).
   * Use raw `.ROBLOSECURITY=...` or token only; never commit real values. Pair with TRADE_BOT_ROBLOX_USERNAME.
   */
  TRADE_BOT_COOKIE: z.string().optional(),
  /** Roblox display username for the bot (required if TRADE_BOT_COOKIE is set). */
  TRADE_BOT_ROBLOX_USERNAME: z.string().optional(),
  /** Numeric Roblox user id for the bot (optional). */
  TRADE_BOT_ROBLOX_USER_ID: z.string().optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

let cached: AppConfig | null = null;

const REQUIRED_ENV_HINT =
  "Set secrets in your host (e.g. Render → Environment). See repo root `.env.example` for all keys. " +
  "Required: APP_URL, DATABASE_URL, REDIS_URL, JWT_SECRET (≥32 chars), ENCRYPTION_KEY (≥32), " +
  "TRADE_HMAC_SECRET (≥16), CSRF_SECRET (≥32).";

export function getConfig(): AppConfig {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors);
    console.error(REQUIRED_ENV_HINT);
    throw new Error(`Invalid environment configuration. ${REQUIRED_ENV_HINT}`);
  }
  cached = parsed.data;
  return cached;
}
