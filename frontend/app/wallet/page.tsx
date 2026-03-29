"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { RequireAuth } from "@/components/RequireAuth";
import { BloxyPageHeader } from "@/components/bloxy/BloxyPageHeader";
import { apiFetch } from "@/lib/api";
import type { Me, RobloxInvItem, SiteItem } from "@/lib/types";

function apiErrorMessage(data: unknown, fallback: string): string {
  if (typeof data !== "object" || data === null || !("error" in data)) return fallback;
  const err = (data as { error: unknown }).error;
  if (typeof err === "string") return err;
  if (typeof err === "object" && err !== null) {
    const flat = err as { formErrors?: string[]; fieldErrors?: Record<string, unknown> };
    if (Array.isArray(flat.formErrors) && flat.formErrors.length > 0) return flat.formErrors.join(" ");
    if (flat.fieldErrors && typeof flat.fieldErrors === "object") {
      const parts = Object.entries(flat.fieldErrors).flatMap(([k, v]) => {
        if (Array.isArray(v)) return v.map((m) => `${k}: ${String(m)}`);
        return [`${k}: ${String(v)}`];
      });
      if (parts.length > 0) return parts.join("; ");
    }
    try {
      return JSON.stringify(err);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function WalletContent() {
  const [me, setMe] = useState<Me | null>(null);
  const [robloxItems, setRobloxItems] = useState<RobloxInvItem[]>([]);
  const [siteItems, setSiteItems] = useState<SiteItem[]>([]);
  const [tab, setTab] = useState<"profile" | "roblox" | "site" | "trades" | "ledger" | "history">("profile");
  const [trades, setTrades] = useState<
    { id: string; direction: string; status: string; botUsername: string; expiresAt: string | null; failureReason: string | null }[]
  >([]);
  const [depositRows, setDepositRows] = useState<
    { id: string; status: string; initiatedAt: string; matchedSenderName?: string | null; bot?: { robloxUsername: string } }[]
  >([]);
  const [withdrawRows, setWithdrawRows] = useState<
    { id: string; status: string; initiatedAt: string; bot?: { robloxUsername: string } }[]
  >([]);
  const [ledger, setLedger] = useState<
    { id: string; amount: number; balanceAfter: number; entryType: string; createdAt: string }[]
  >([]);
  const [selectedRoblox, setSelectedRoblox] = useState<Set<string>>(new Set());
  const [selectedSite, setSelectedSite] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  /** GET /api/inventory/fetch failed — shown on Roblox tab only. */
  const [inventoryErr, setInventoryErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ledgerFilter, setLedgerFilter] = useState<"all" | "deposits" | "withdrawals" | "wins" | "losses">("all");

  async function load() {
    setErr(null);
    const r = await apiFetch("/api/auth/me");
    if (!r.ok) {
      setMe(null);
      setLoading(false);
      return;
    }
    const u = (await r.json()) as Me;
    setMe(u);

    setInventoryErr(null);
    const [inv, dep, tr, led, wd, dp] = await Promise.all([
      apiFetch("/api/inventory/fetch"),
      apiFetch("/api/inventory/deposited"),
      apiFetch("/api/inventory/trades"),
      apiFetch("/api/wallet/ledger"),
      apiFetch("/api/wallet/withdrawals"),
      apiFetch("/api/wallet/deposits"),
    ]);
    if (inv.ok) {
      const d = await inv.json();
      setRobloxItems(d.items ?? []);
    } else {
      setRobloxItems([]);
      const raw = await inv.text().catch(() => "");
      let j: unknown = {};
      try {
        j = raw ? JSON.parse(raw) : {};
      } catch {
        j = {};
      }
      setInventoryErr(apiErrorMessage(j, `Could not load Roblox inventory (HTTP ${inv.status}).`));
    }
    if (dep.ok) {
      const d = await dep.json();
      setSiteItems(d.items ?? []);
    }
    if (tr.ok) {
      const d = await tr.json();
      setTrades(d.trades ?? []);
    }
    if (led.ok) {
      const d = await led.json();
      setLedger(d.entries ?? []);
    }
    if (dp.ok) {
      const d = (await dp.json()) as {
        deposits?: {
          id: string;
          status: string;
          initiatedAt: string;
          matchedSenderName?: string | null;
          bot?: { robloxUsername: string } | null;
        }[];
      };
      setDepositRows(
        (d.deposits ?? []).map((x) => ({
          id: x.id,
          status: x.status,
          initiatedAt: x.initiatedAt,
          matchedSenderName: x.matchedSenderName,
          bot: x.bot ?? undefined,
        })),
      );
    } else {
      setDepositRows([]);
    }
    if (wd.ok) {
      const d = (await wd.json()) as {
        withdrawals?: {
          id: string;
          status: string;
          initiatedAt: string;
          bot?: { robloxUsername: string } | null;
        }[];
      };
      setWithdrawRows(
        (d.withdrawals ?? []).map((x) => ({
          id: x.id,
          status: x.status,
          initiatedAt: x.initiatedAt,
          bot: x.bot ?? undefined,
        })),
      );
    } else {
      setWithdrawRows([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  /** Tradable items not yet on site — may have 0 value (shown, not depositable). */
  const offSiteTradable = useMemo(() => robloxItems.filter((i) => i.tradable && !i.onSite), [robloxItems]);
  const depositable = useMemo(() => offSiteTradable.filter((i) => i.valueCoins > 0), [offSiteTradable]);

  async function deposit() {
    setMsg(null);
    setErr(null);
    const items = depositable.filter((i) => selectedRoblox.has(i.userAssetId));
    if (items.length === 0) {
      setErr(
        "Select at least one priced item (◈ > 0). Run npm run db:seed for Roblox Limited catalog prices, or set values in admin. Items at ◈ 0 cannot be deposited.",
      );
      return;
    }
    const body = {
      items: items.map((i) => ({
        robloxAssetId: i.robloxAssetId,
        userAssetId: i.userAssetId,
        itemName: i.itemName,
        gameSource: i.gameSource,
        valueCoins: i.valueCoins,
      })),
    };
    const res = await apiFetch("/api/inventory/deposit", { method: "POST", body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(apiErrorMessage(j, "Deposit failed."));
      return;
    }
    setMsg(`Trade queued: ${j.tradeId ?? "ok"}. With mock trades, items appear on site shortly.`);
    setSelectedRoblox(new Set());
    await load();
  }

  async function withdraw() {
    setMsg(null);
    setErr(null);
    const ids = [...selectedSite];
    if (ids.length === 0) {
      setErr("Select site items to withdraw.");
      return;
    }
    const res = await apiFetch("/api/inventory/withdraw", {
      method: "POST",
      body: JSON.stringify({ userItemIds: ids }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(apiErrorMessage(j, "Withdraw failed."));
      return;
    }
    setMsg(`Withdrawal queued: ${j.tradeId ?? "ok"}.`);
    setSelectedSite(new Set());
    await load();
  }

  if (loading) {
    return <p className="text-text-secondary">Loading…</p>;
  }

  if (!me) {
    return (
      <div className="rounded-xl border border-border-default bg-bg-secondary p-8 text-center">
        <p className="text-text-secondary">Log in with bio verification to view profile and inventory.</p>
        <a href="/login" className="mt-4 inline-block rounded-xl bg-accent-cyan px-6 py-2.5 text-sm font-bold text-[#0a0e14] shadow-glow-cyan">
          Go to login
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <BloxyPageHeader
        title="Wallet"
        subtitle="Deposits, withdrawals, Roblox Limited inventory, and ledger — same flow as BloxyBet-style trade hub."
        eyebrow="Balance & trades"
      />
      <div className="flex flex-wrap gap-2 border-b border-border-default pb-3">
        {(
          [
            ["profile", "Profile"],
            ["roblox", "Roblox inventory"],
            ["site", "Site inventory"],
            ["trades", "Trade sessions"],
            ["history", "Deposit / withdraw"],
            ["ledger", "Coin ledger"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setErr(null);
              setMsg(null);
              setTab(k);
            }}
            className={`min-h-[44px] rounded-pill px-4 text-sm font-medium ${
              tab === k
                ? "bg-accent-cyan font-bold text-[#0a0e14] shadow-glow-cyan"
                : "border border-border-default bg-bg-tertiary text-text-secondary hover:border-accent-cyan/25 hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {me.mockRobloxTrades === true && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          <strong>Simulated Roblox trades (MOCK_ROBLOX_TRADES).</strong> The site updates only — no real Roblox trade runs. For live trades, set{" "}
          <span className="font-mono">MOCK_ROBLOX_TRADES=false</span> in <span className="font-mono">.env</span> and restart the API.
        </p>
      )}
      {me.mockRobloxTrades === false && (
        <div className="space-y-2 rounded-xl border border-accent-cyan/25 bg-accent-cyan/10 px-3 py-2 text-sm text-text-primary">
          <p>
            <strong>Live Roblox trades.</strong> Send your <strong>Roblox Limited</strong> items to the bot via Roblox&apos;s trade system. Bots need a valid cookie in admin, trading unlocked, and inventory visibility where required.
          </p>
          <ul className="list-inside list-disc space-y-1 text-xs text-text-secondary">
            <li>Only Roblox Limited items (Limited badge on roblox.com) are accepted.</li>
            <li>Roblox Premium is required to trade Limited items.</li>
            <li>The bot must be on your friends list or have trades open to everyone.</li>
            <li>After a trade, Roblox may hold items for up to ~2 days before they can be traded again.</li>
          </ul>
          <p className="text-xs text-text-secondary">
            <strong>Withdrawals:</strong> You will receive a trade offer on Roblox — check your trade inbox. Accept within ~3 days or the offer expires. Premium is required to accept Limited trades.
          </p>
        </div>
      )}
      {msg && <p className="rounded-lg bg-success/15 px-3 py-2 text-sm text-success">{msg}</p>}
      {err && <p className="rounded-lg bg-accent/15 px-3 py-2 text-sm text-accent">{err}</p>}

      {tab === "profile" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-6 md:grid-cols-[200px_1fr]">
          <div className="flex flex-col items-center rounded-xl border border-border-default bg-bg-secondary p-4">
            {me.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={me.avatarUrl} alt="" className="h-36 w-36 rounded-xl object-cover" />
            ) : (
              <div className="flex h-36 w-36 items-center justify-center rounded-xl bg-surface text-4xl font-bold">
                {(me.displayName || me.username).slice(0, 1)}
              </div>
            )}
            <p className="mt-3 text-center font-semibold">{me.displayName || me.username}</p>
            <p className="text-sm text-text-secondary">@{me.username}</p>
            {me.hasVerifiedBadge && <span className="mt-1 text-xs text-primary">✓ Verified</span>}
            <a
              href={me.profileUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 text-sm text-primary hover:underline"
            >
              Open Roblox profile ↗
            </a>
          </div>
          <div className="space-y-3 rounded-xl border border-border-default bg-bg-secondary p-5 text-sm">
            <h2 className="text-lg font-bold text-text-primary">Account details</h2>
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-text-secondary">Roblox user ID</dt>
                <dd className="font-mono text-text-primary">{me.robloxId}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Site user ID</dt>
                <dd className="font-mono text-xs text-text-primary">{me.id}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Robux</dt>
                <dd className="text-white">
                  {me.robux !== null && me.robux !== undefined ? `R$ ${me.robux.toLocaleString()}` : "— (not available with bio login)"}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Site balance</dt>
                <dd className="text-primary">
                  ◈ {Math.round(me.balanceCoins)}
                  {me.lockedCoins != null && me.lockedCoins > 0 && (
                    <span className="text-text-secondary"> ({Math.round(me.lockedCoins)} locked)</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Roblox account created</dt>
                <dd className="text-text-primary">
                  {me.accountCreatedAt ? new Date(me.accountCreatedAt).toLocaleString() : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Account age</dt>
                <dd className="text-text-primary">{me.accountAgeDays !== null ? `${me.accountAgeDays} days` : "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-text-secondary">Bio</dt>
                <dd className="text-text-primary">{me.description || "—"}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Roblox ban status</dt>
                <dd className={me.isBannedOnRoblox ? "text-accent" : "text-success"}>
                  {me.isBannedOnRoblox ? "Banned on Roblox" : "Not banned"}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Last login IP (site)</dt>
                <dd className="font-mono text-xs text-text-primary">{me.lastLoginIp ?? "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-text-secondary">Preferred trade bot</dt>
                <dd className="text-text-primary">
                  {me.linkedBot
                    ? `${me.linkedBot.robloxUsername} (${me.linkedBot.id.slice(0, 8)}…)`
                    : "— (optional — POST /api/users/me/linked-bot with bot id from admin)"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-text-secondary">Roblox trade mode</dt>
                <dd className="text-text-primary">
                  {me.mockRobloxTrades ? "Mock / simulated (site-only)" : "Real (requires working bot + Roblox APIs)"}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-text-secondary">
              Joined site: {new Date(me.siteCreatedAt).toLocaleString()} · Security score: {me.suspiciousScore}
            </p>
            <Link href="/coinflip" className="inline-block text-sm text-primary">
              → Play coinflip
            </Link>
          </div>
        </motion.div>
      )}

      {tab === "roblox" && (
        <div>
          {inventoryErr && (
            <p className="mb-3 rounded-lg bg-accent/15 px-3 py-2 text-sm text-accent">{inventoryErr}</p>
          )}
          <p className="mb-3 text-sm text-text-secondary">
            Roblox <strong className="text-text-primary">Limited</strong> collectibles (public inventory API). Values come from the admin catalog — items without a match show ◈ 0 and cannot be deposited. Send accepted trades to the assigned bot via Roblox&apos;s trade system when live mode is on.
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void deposit()}
              className="min-h-[44px] rounded-xl bg-accent-cyan px-4 text-sm font-bold text-[#0a0e14] shadow-glow-cyan"
            >
              Deposit selected
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {offSiteTradable.map((it) => {
              const canDepositItem = it.valueCoins > 0;
              return (
                <button
                  key={it.userAssetId}
                  type="button"
                  disabled={!canDepositItem}
                  onClick={() => {
                    if (!canDepositItem) return;
                    setSelectedRoblox((prev) => {
                      const n = new Set(prev);
                      if (n.has(it.userAssetId)) n.delete(it.userAssetId);
                      else n.add(it.userAssetId);
                      return n;
                    });
                  }}
                  className={`rounded-xl border p-3 text-left transition ${
                    !canDepositItem
                      ? "cursor-not-allowed border-border-default bg-bg-secondary opacity-70"
                      : selectedRoblox.has(it.userAssetId)
                        ? "border-accent-cyan ring-2 ring-accent-cyan/40"
                        : "border-border-default bg-bg-secondary hover:border-accent-cyan/30"
                  }`}
                >
                  <div className="aspect-square w-full overflow-hidden rounded-lg bg-surface">
                    {it.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <p className="mt-2 truncate text-sm font-medium">{it.itemName}</p>
                  <p className="text-xs text-text-secondary">🎮 {it.gameSource}</p>
                  <p className="text-sm text-primary">◈ {it.valueCoins}</p>
                  {!canDepositItem && <p className="text-xs text-warning">No admin value — cannot deposit</p>}
                </button>
              );
            })}
          </div>
          {offSiteTradable.length === 0 && !inventoryErr && (
            <p className="text-text-secondary">
              No tradable items off-site. If you own collectibles on Roblox, check inventory privacy on your profile; otherwise they may already be under Site
              inventory.
            </p>
          )}
        </div>
      )}

      {tab === "trades" && (
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            Deposit and withdrawal sessions. For real trades, send <strong className="text-text-primary">Roblox Limited</strong> items to the shown bot via Roblox trades (mock mode auto-completes on the site only).
          </p>
          <ul className="space-y-2 text-sm">
            {trades.map((t) => (
              <li key={t.id} className="rounded-xl border border-border-default bg-bg-secondary px-3 py-2">
                <span className="font-mono text-xs text-text-secondary">{t.id.slice(0, 12)}…</span> ·{" "}
                <span className="text-text-primary">{t.direction}</span> · {t.status}
                {t.botUsername && <span className="text-text-secondary"> · bot: {t.botUsername}</span>}
                {t.expiresAt && <span className="text-text-secondary"> · expires {new Date(t.expiresAt).toLocaleString()}</span>}
                {t.failureReason && <span className="text-accent"> · {t.failureReason}</span>}
              </li>
            ))}
          </ul>
          {trades.length === 0 && <p className="text-text-secondary">No trades yet.</p>}
        </div>
      )}

      {tab === "history" && (
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="font-semibold text-text-primary">Deposits (Roblox → site)</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {depositRows.map((d) => (
                <li key={d.id} className="rounded-xl border border-border-default bg-bg-secondary px-3 py-2">
                  {d.status} · {new Date(d.initiatedAt).toLocaleString()}
                  {d.matchedSenderName ? (
                    <span className="text-text-secondary"> · matched sender: {d.matchedSenderName}</span>
                  ) : null}
                  {d.bot?.robloxUsername ? <span className="text-text-secondary"> · bot {d.bot.robloxUsername}</span> : null}
                </li>
              ))}
            </ul>
            {depositRows.length === 0 && <p className="text-text-secondary">No deposit history.</p>}
          </div>
          <div>
            <h3 className="font-semibold text-text-primary">Withdrawals (site → Roblox)</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {withdrawRows.map((w) => (
                <li key={w.id} className="rounded-xl border border-border-default bg-bg-secondary px-3 py-2">
                  {w.status} · {new Date(w.initiatedAt).toLocaleString()}
                  {w.bot?.robloxUsername ? <span className="text-text-secondary"> · bot {w.bot.robloxUsername}</span> : null}
                </li>
              ))}
            </ul>
            {withdrawRows.length === 0 && <p className="text-text-secondary">No withdrawal history.</p>}
          </div>
        </div>
      )}

      {tab === "ledger" && (
        <div>
          <p className="mb-3 text-sm text-text-secondary">
            Internal coin balance changes (admin, coinflip, jackpot stakes/payouts, refunds).
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            {(
              [
                ["all", "All"],
                ["deposits", "Deposits"],
                ["withdrawals", "Withdrawals"],
                ["wins", "Wins"],
                ["losses", "Losses"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setLedgerFilter(k)}
                className={`rounded-pill px-3 py-1.5 text-xs font-medium ${
                  ledgerFilter === k ? "bg-accent-cyan font-bold text-[#0a0e14]" : "border border-border-default bg-bg-tertiary text-text-secondary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <ul className="space-y-2 text-sm">
            {ledger
              .filter((e) => {
                if (ledgerFilter === "all") return true;
                if (ledgerFilter === "deposits") return e.entryType === "deposit_coin";
                if (ledgerFilter === "withdrawals") return e.entryType === "withdraw_coin";
                if (ledgerFilter === "wins") return e.entryType === "game_win" || e.entryType === "game_payout";
                if (ledgerFilter === "losses") return e.entryType === "game_loss" || e.entryType === "game_stake";
                return true;
              })
              .map((e) => (
                <li key={e.id} className="rounded-xl border border-border-default bg-bg-secondary px-3 py-2 font-mono text-xs">
                  {new Date(e.createdAt).toLocaleString()} · {e.entryType} · {e.amount >= 0 ? "+" : ""}
                  {e.amount} → balance {e.balanceAfter}
                </li>
              ))}
          </ul>
          {ledger.length === 0 && <p className="text-text-secondary">No ledger entries yet.</p>}
        </div>
      )}

      {tab === "site" && (
        <div>
          <p className="mb-3 text-sm text-text-secondary">Items credited after completed deposit trades.</p>
          <button
            type="button"
            onClick={() => void withdraw()}
            className="mb-3 min-h-[44px] rounded-xl border border-border-default bg-bg-tertiary px-4 text-sm font-semibold text-text-primary hover:border-accent-cyan/25"
          >
            Withdraw selected
          </button>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {siteItems.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => {
                  setSelectedSite((prev) => {
                    const n = new Set(prev);
                    if (n.has(it.id)) n.delete(it.id);
                    else n.add(it.id);
                    return n;
                  });
                }}
                className={`rounded-xl border p-3 text-left ${
                  selectedSite.has(it.id) ? "border-accent-cyan ring-2 ring-accent-cyan/40" : "border-border-default bg-bg-secondary"
                }`}
              >
                <div className="aspect-square w-full overflow-hidden rounded-lg bg-surface">
                  {it.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <p className="mt-2 truncate text-sm font-medium">{it.itemName}</p>
                <p className="text-xs text-text-secondary">🎮 {it.gameSource}</p>
                <p className="text-sm text-primary">◈ {it.valueCoins}</p>
              </button>
            ))}
          </div>
          {siteItems.length === 0 && <p className="text-text-secondary">No items on site yet — deposit from the Roblox tab.</p>}
        </div>
      )}
    </div>
  );
}

export default function WalletPage() {
  return (
    <RequireAuth>
      <WalletContent />
    </RequireAuth>
  );
}
