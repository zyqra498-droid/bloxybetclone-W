import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import cookie from "cookie";
import { verifyAccessToken } from "../lib/jwt.js";
import { getConfig } from "../config.js";
import { setIo } from "./registry.js";

export function attachSocket(httpServer: HttpServer): Server {
  const { APP_URL, FRONTEND_URL } = getConfig();
  const origin = FRONTEND_URL ?? APP_URL;

  const io = new Server(httpServer, {
    cors: { origin, credentials: true },
    connectionStateRecovery: {},
  });

  io.use((socket, next) => {
    try {
      const raw = socket.handshake.headers.cookie;
      const cookies = raw ? cookie.parse(raw) : {};
      const token = cookies.access_token;
      if (!token) {
        next();
        return;
      }
      const p = verifyAccessToken(token);
      socket.data.userId = p.sub;
      next();
    } catch {
      next();
    }
  });

  io.on("connection", (socket) => {
    const uid = socket.data.userId as string | undefined;
    if (uid) {
      socket.join(`user:${uid}`);
    }
    socket.join("lobby");

    let events = 0;
    const reset = setInterval(() => {
      events = 0;
    }, 1000);
    socket.on("disconnect", () => clearInterval(reset));

    socket.use((event, next) => {
      events += 1;
      if (events > 20) {
        next(new Error("event rate"));
        return;
      }
      next();
    });
  });

  setIo(io);
  return io;
}
