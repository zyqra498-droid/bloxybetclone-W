import type { Server as IOServer } from "socket.io";

let io: IOServer | null = null;

export function setIo(server: IOServer): void {
  io = server;
}

export function getIo(): IOServer | null {
  return io;
}

/** Approximate concurrent socket connections (engine count). */
export function getConnectionCount(): number {
  return io?.engine?.clientsCount ?? 0;
}
