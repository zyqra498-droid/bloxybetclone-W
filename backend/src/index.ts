import http from "node:http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { getConfig } from "./config.js";
import { csrfCookieMiddleware } from "./middleware/csrf.js";
import { optionalAuth } from "./middleware/auth.js";
import { globalUserLimiter } from "./middleware/rateLimits.js";
import { attachSocket } from "./socket/setup.js";
import { registerTradeWorker } from "./services/tradeQueue.js";
import { startJackpotTimer } from "./services/jackpotTimer.js";

import authRoutes from "./routes/auth.js";
import inventoryRoutes from "./routes/inventory.js";
import coinflipRoutes from "./routes/coinflip.js";
import jackpotRoutes from "./routes/jackpot.js";
import botsRoutes from "./routes/bots.js";
import adminRoutes from "./routes/admin.js";
import caseBattlesRoutes from "./routes/caseBattles.js";
import verifyRoutes from "./routes/verify.js";
import webhooksRoutes from "./routes/webhooks.js";
import notificationsRoutes from "./routes/notifications.js";
import walletRoutes from "./routes/wallet.js";
import usersRoutes from "./routes/users.js";
import statsRoutes from "./routes/stats.js";
import catalogRoutes from "./routes/catalog.js";
import { startCoinflipCoinExpireScheduler } from "./services/coinflipCoinExpire.js";
import { syncTradeBotFromEnv } from "./services/tradeBotEnv.js";

const app = express();
const cfg = getConfig();

app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: cfg.NODE_ENV === "production" ? undefined : false,
  }),
);
app.use(
  cors({
    origin: cfg.FRONTEND_URL ?? cfg.APP_URL,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "4mb" }));
app.use(csrfCookieMiddleware);
app.use(optionalAuth);
app.use(globalUserLimiter);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/games/coinflip", coinflipRoutes);
app.use("/api/games/jackpot", jackpotRoutes);
app.use("/api/bots", botsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/games/case-battles", caseBattlesRoutes);
app.use("/api/verify", verifyRoutes);
app.use("/api/webhooks", webhooksRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/catalog", catalogRoutes);

const server = http.createServer(app);
attachSocket(server);
registerTradeWorker();
startJackpotTimer();
startCoinflipCoinExpireScheduler();

syncTradeBotFromEnv()
  .then(() => {
    server.listen(cfg.PORT, () => {
      console.log(`API listening on :${cfg.PORT}`);
    });
  })
  .catch((e) => {
    console.error("[trade-bot] env sync failed", e);
    process.exit(1);
  });
