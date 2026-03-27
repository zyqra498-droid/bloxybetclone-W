"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { CoinflipRoomRow } from "@/components/bloxy/CoinflipRoomRow";
import { apiFetch } from "@/lib/api";
import type { SiteItem, Me } from "@/lib/types";
import { getSocket } from "@/lib/socket";
import { AsyncButton } from "@/components/AsyncButton";
import { formatCoins } from "@/lib/format";

type Room = {
  id: string;
  stakeMode?: "items" | "coins";
  creatorId: string;
  creator: { username: string; avatarUrl?: string | null };
  creatorItemsJson?: { itemName?: string; thumb?: string; valueCoins?: number }[] | null;
  total: number;
  expiresAt: string;
};

const REACTIONS = ["🔥", "💀", "😂", "🤑", "😤", "🎲"];

function CoinflipPageInner() {
  const searchParams = useSearchParams();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [siteItems, setSiteItems] = useState<SiteItem[]>([]);
  const [selectedCreate, setSelectedCreate] = useState<Set<string>>(new Set());
  const [selectedJoin, setSelectedJoin] = useState<Set<string>>(new Set());
  const [joinRoom, setJoinRoom] = useState<Room | null>(null);
  const [coinStake, setCoinStake] = useState<string>("100");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [mode, setMode] = useState<"items" | "coins">("items");
  const [step, setStep] = useState(1);
  const [flipPhase, setFlipPhase] = useState<"idle" | "spinning" | "done">("idle");
  const [flipWon, setFlipWon] = useState<boolean | null>(null);
  const [seedReveal, setSeedReveal] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [r, u, dep] = await Promise.all([
      fetch("/api/games/coinflip/rooms").then((x) => x.json()),
      apiFetch("/api/auth/me").then(async (x) => (x.ok ? ((await x.json()) as Me) : null)),
      apiFetch("/api/inventory/deposited").then((x) => (x.ok ? x.json() : { items: [] })),
    ]);
    setRooms(r.rooms ?? []);
    setMe(u);
    setSiteItems(dep.items ?? []);
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 5000);
    const s = getSocket();
    const onRoom = () => void refresh();
    s.on("coinflip:room_created", onRoom);
    s.on("coinflip:game_result", onRoom);
    return () => {
      clearInterval(t);
      s.off("coinflip:room_created", onRoom);
      s.off("coinflip:game_result", onRoom);
    };
  }, [refresh]);

  useEffect(() => {
    const jid = searchParams.get("join");
    if (!jid || !me) return;
    const r = rooms.find((x) => x.id === jid);
    if (r && r.creatorId !== me.id) setJoinRoom(r);
  }, [searchParams, rooms, me]);

  const stakeItems = siteItems.filter((i) => i.status === "deposited");

  async function createRoom() {
    setErr(null);
    setMsg(null);
    const ids = [...selectedCreate];
    if (ids.length === 0) {
      setErr("Select items to stake.");
      return;
    }
    const res = await apiFetch("/api/games/coinflip/create", {
      method: "POST",
      body: JSON.stringify({ userItemIds: ids }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(typeof j.error === "string" ? j.error : JSON.stringify(j.error ?? "Failed"));
      return;
    }
    setMsg(`Room created: ${j.roomId}. Waiting for opponent…`);
    setSelectedCreate(new Set());
    setCreateOpen(false);
    setStep(1);
    await refresh();
  }

  async function createCoinRoom() {
    setErr(null);
    setMsg(null);
    const n = Number(coinStake);
    if (!Number.isFinite(n) || n <= 0) {
      setErr("Enter a valid stake amount.");
      return;
    }
    const res = await apiFetch("/api/games/coinflip/create-coins", {
      method: "POST",
      body: JSON.stringify({ stakeCoins: n }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(typeof j.error === "string" ? j.error : JSON.stringify(j.error ?? "Failed"));
      return;
    }
    setMsg(`Coin room created: ${j.roomId}. Waiting for opponent…`);
    setCreateOpen(false);
    setStep(1);
    await refresh();
  }

  async function confirmJoinRoom() {
    if (!joinRoom) return;
    setErr(null);
    setMsg(null);
    setFlipPhase("spinning");
    setFlipWon(null);
    setSeedReveal(null);

    if (joinRoom.stakeMode === "coins") {
      const res = await apiFetch(`/api/games/coinflip/join-coins/${joinRoom.id}`, {
        method: "POST",
        body: "{}",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "Join failed");
        setFlipPhase("idle");
        return;
      }
      const won = !!(me && j.winnerId === me.id);
      setJoinRoom(null);
      window.setTimeout(() => {
        setFlipPhase("done");
        setFlipWon(won);
        if (won) void confetti({ particleCount: 140, spread: 70, origin: { y: 0.65 } });
        setSeedReveal(JSON.stringify(j, null, 2));
        setMsg(`Winner: ${String(j.winnerId).slice(0, 8)}… · pot ◈${typeof j.pot === "number" ? j.pot.toFixed(0) : "?"}`);
      }, 3000);
      await refresh();
      return;
    }
    const ids = [...selectedJoin];
    if (ids.length === 0) {
      setErr("Select items matching room value (±5%).");
      setFlipPhase("idle");
      return;
    }
    const res = await apiFetch(`/api/games/coinflip/join/${joinRoom.id}`, {
      method: "POST",
      body: JSON.stringify({ userItemIds: ids }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(typeof j.error === "string" ? j.error : "Join failed");
      setFlipPhase("idle");
      return;
    }
    const won = !!(me && j.winnerId === me.id);
    setJoinRoom(null);
    setSelectedJoin(new Set());
    window.setTimeout(() => {
      setFlipPhase("done");
      setFlipWon(won);
      if (won) void confetti({ particleCount: 140, spread: 70, origin: { y: 0.65 } });
      setSeedReveal(JSON.stringify(j, null, 2));
      setMsg(`Result: winner ${String(j.winnerId ?? "").slice(0, 8)}…`);
    }, 3000);
    await refresh();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-text-primary">Coinflip</h1>
          <p className="text-sm text-text-secondary">Stake items or coins — 50/50 provably fair resolution.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-pill bg-accent-cyan px-4 py-2 text-sm font-bold text-[#0a0e14] shadow-glow-cyan">Limiteds</span>
          <button
            type="button"
            onClick={() => {
              setCreateOpen(true);
              setStep(1);
            }}
            className="rounded-xl bg-accent-cyan px-5 py-2.5 text-sm font-bold text-[#0a0e14] shadow-glow-cyan transition hover:brightness-110 active:scale-[0.98]"
          >
            Create
          </button>
          <Link
            href="/leaderboard"
            className="rounded-xl border border-border-default bg-bg-tertiary px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:border-accent-cyan/25"
          >
            History
          </Link>
        </div>
      </div>

      {msg && <p className="rounded-lg bg-accent-green/15 px-3 py-2 text-sm text-accent-green">{msg}</p>}
      {err && <p className="rounded-lg bg-accent-red/15 px-3 py-2 text-sm text-accent-red">{err}</p>}

      <AnimatePresence>
        {flipPhase !== "idle" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/80 p-4"
          >
            <div className="coin-scene mb-6 flex h-40 w-40 items-center justify-center rounded-full bg-bg-tertiary">
              <div
                className={`coin-3d h-32 w-32 rounded-full border-4 border-accent-gold ${
                  flipPhase === "done" ? (flipWon ? "shadow-[0_0_40px_rgba(59,130,246,0.55)]" : "opacity-50 shadow-[0_0_30px_rgba(255,77,77,0.4)]") : ""
                }`}
              />
            </div>
            <p className="font-display text-xl text-text-primary">
              {flipPhase === "spinning" && "Flipping…"}
              {flipPhase === "done" && flipWon && "You won!"}
              {flipPhase === "done" && flipWon === false && "You lost"}
            </p>
            {flipPhase === "done" && (
              <div className="mt-4 flex gap-2">
                {REACTIONS.map((e) => (
                  <button key={e} type="button" className="text-2xl hover:scale-110" onClick={() => {}}>
                    {e}
                  </button>
                ))}
              </div>
            )}
            {seedReveal && flipPhase === "done" && (
              <pre className="mt-4 max-h-40 max-w-lg overflow-auto rounded-lg bg-bg-secondary p-3 text-left text-[10px] text-text-secondary">
                {seedReveal}
              </pre>
            )}
            {flipPhase === "done" && (
              <button
                type="button"
                className="mt-4 rounded-xl bg-accent-cyan px-4 py-2 text-sm font-bold text-[#0a0e14]"
                onClick={() => {
                  setFlipPhase("idle");
                  setSeedReveal(null);
                }}
              >
                Close
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {createOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setCreateOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border-default bg-bg-secondary p-6 shadow-card"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-display text-xl font-bold text-text-primary">Create coinflip</h3>
              <p className="text-xs text-text-secondary">Step {step} of 3</p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("items")}
                  className={`flex-1 rounded-xl py-2 text-sm font-semibold ${mode === "items" ? "bg-accent-cyan font-bold text-[#0a0e14]" : "bg-bg-tertiary"}`}
                >
                  Items
                </button>
                <button
                  type="button"
                  onClick={() => setMode("coins")}
                  className={`flex-1 rounded-xl py-2 text-sm font-semibold ${mode === "coins" ? "bg-accent-cyan font-bold text-[#0a0e14]" : "bg-bg-tertiary"}`}
                >
                  Coins
                </button>
              </div>
              {step === 1 && (
                <div className="mt-4">
                  <p className="text-sm text-text-secondary">Choose mode, then continue.</p>
                  <AsyncButton
                    className="mt-4 w-full rounded-xl bg-accent-cyan py-3 text-sm font-bold text-[#0a0e14]"
                    onClickAsync={async () => setStep(2)}
                  >
                    Continue
                  </AsyncButton>
                </div>
              )}
              {step === 2 && mode === "coins" && me && (
                <div className="mt-4 space-y-3">
                  <label className="text-sm">
                    Stake
                    <input
                      type="number"
                      className="mt-1 w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2"
                      value={coinStake}
                      onChange={(e) => setCoinStake(e.target.value)}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[100, 500, 1000].map((x) => (
                      <button
                        key={x}
                        type="button"
                        className="rounded-pill bg-bg-tertiary px-3 py-1 text-xs"
                        onClick={() => setCoinStake(String(x))}
                      >
                        +{x}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="rounded-pill bg-bg-tertiary px-3 py-1 text-xs"
                      onClick={() => setCoinStake(String(Math.round(me.balanceCoins)))}
                    >
                      MAX
                    </button>
                  </div>
                  <p className="text-xs text-text-secondary">Balance ◈ {formatCoins(me.balanceCoins)}</p>
                  <AsyncButton
                    className="w-full rounded-xl bg-accent-cyan py-3 text-sm font-bold text-[#0a0e14]"
                    onClickAsync={async () => setStep(3)}
                  >
                    Continue
                  </AsyncButton>
                </div>
              )}
              {step === 2 && mode === "items" && (
                <div className="mt-4">
                  <p className="text-sm text-text-secondary">Select items from your inventory.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {stakeItems.map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() =>
                          setSelectedCreate((p) => {
                            const n = new Set(p);
                            if (n.has(it.id)) n.delete(it.id);
                            else n.add(it.id);
                            return n;
                          })
                        }
                        className={`rounded-lg border px-3 py-2 text-left text-xs ${
                          selectedCreate.has(it.id) ? "border-accent-cyan bg-accent-cyan/10" : "border-border-default"
                        }`}
                      >
                        {it.itemName} · ◈{it.valueCoins}
                      </button>
                    ))}
                  </div>
                  <AsyncButton
                    className="mt-4 w-full rounded-xl bg-accent-cyan py-3 text-sm font-bold text-[#0a0e14]"
                    onClickAsync={async () => setStep(3)}
                  >
                    Continue
                  </AsyncButton>
                </div>
              )}
              {step === 3 && (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-text-secondary">Confirm summary</p>
                  <div className="rounded-lg border border-border bg-bg-tertiary p-3 text-sm">
                    {mode === "coins" ? (
                      <p>
                        Coin stake: ◈ <span className="font-display text-accent-gold">{coinStake}</span>
                      </p>
                    ) : (
                      <p>{selectedCreate.size} items selected</p>
                    )}
                  </div>
                  <AsyncButton
                    className="w-full rounded-xl bg-accent-cyan py-3 text-sm font-bold text-[#0a0e14]"
                    onClickAsync={async () => {
                      if (mode === "coins") await createCoinRoom();
                      else await createRoom();
                    }}
                  >
                    Confirm & create
                  </AsyncButton>
                </div>
              )}
              <button type="button" className="mt-4 w-full text-sm text-text-secondary" onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <section>
        <h2 className="font-display text-lg font-bold uppercase tracking-wide text-text-secondary">Open rooms</h2>
        <div className="mt-4 flex flex-col gap-3">
          {rooms.map((r, i) => (
            <CoinflipRoomRow
              key={r.id}
              room={r}
              meId={me?.id}
              onJoin={() => {
                setJoinRoom(r);
                setSelectedJoin(new Set());
              }}
              index={i}
            />
          ))}
        </div>
        {rooms.length === 0 && <p className="rounded-2xl border border-dashed border-border-default py-10 text-center text-text-secondary">No open rooms.</p>}
      </section>

      {joinRoom && me && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-bg-secondary p-5">
            <h3 className="font-semibold text-text-primary">Join room</h3>
            {joinRoom.stakeMode === "coins" ? (
              <p className="text-xs text-text-secondary">Stake ◈{formatCoins(joinRoom.total)} from your balance.</p>
            ) : (
              <>
                <p className="text-xs text-text-secondary">Pick items within ±5% of creator stake.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {stakeItems.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() =>
                        setSelectedJoin((p) => {
                          const n = new Set(p);
                          if (n.has(it.id)) n.delete(it.id);
                          else n.add(it.id);
                          return n;
                        })
                      }
                      className={`rounded-lg border px-3 py-2 text-left text-xs ${
                        selectedJoin.has(it.id) ? "border-accent-cyan bg-accent-cyan/10" : "border-border-default"
                      }`}
                    >
                      {it.itemName} · ◈{it.valueCoins}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="mt-4 flex gap-2">
              <AsyncButton
                className="rounded-xl bg-accent-cyan px-4 py-2 text-sm font-bold text-[#0a0e14] shadow-glow-cyan"
                onClickAsync={confirmJoinRoom}
              >
                Confirm join
              </AsyncButton>
              <button type="button" onClick={() => setJoinRoom(null)} className="rounded-xl border border-border-default bg-bg-tertiary px-4 py-2 text-sm font-medium">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CoinflipPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40dvh] items-center justify-center text-sm text-text-secondary">Loading coinflip…</div>
      }
    >
      <CoinflipPageInner />
    </Suspense>
  );
}
