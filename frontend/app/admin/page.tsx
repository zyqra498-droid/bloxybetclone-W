"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, withAdminTotp } from "@/lib/api";

type Tab = "overview" | "users" | "values" | "trades" | "audit" | "house";

type AdminUser = {
  id: string;
  username: string;
  robloxId: string;
  balanceCoins: unknown;
  banned: boolean;
  banReason: string | null;
  isAdmin: boolean;
  createdAt: string;
};

type TradeRow = {
  id: string;
  status: string;
  direction: string;
  initiatedAt: string;
  user: { username: string };
  bot: { robloxUsername: string };
};

type AuditRow = {
  id: string;
  userId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
};

type ItemValueRow = {
  id: string;
  robloxAssetId: string;
  robloxCatalogAssetId: string | null;
  itemName: string;
  gameSource: string;
  valueCoins: number;
};

function CatalogEditableRow({
  row,
  adminPost,
  needsTotp,
  totp,
  onDone,
}: {
  row: ItemValueRow;
  adminPost: (path: string, body: object) => Promise<Response>;
  needsTotp: boolean;
  totp: string;
  onDone: (msg: string, err: string | null) => void;
}) {
  const [name, setName] = useState(row.itemName);
  const [gameSource, setGameSource] = useState(row.gameSource);
  const [valueCoins, setValueCoins] = useState(String(row.valueCoins));
  const [catalogId, setCatalogId] = useState(row.robloxCatalogAssetId ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(row.itemName);
    setGameSource(row.gameSource);
    setValueCoins(String(row.valueCoins));
    setCatalogId(row.robloxCatalogAssetId ?? "");
  }, [row]);

  async function saveRow() {
    const valueNum = Number(String(valueCoins).replace(/,/g, ""));
    if (!name.trim() || Number.isNaN(valueNum) || valueNum < 0) {
      onDone("", "Row: invalid name or value.");
      return;
    }
    if (needsTotp && !totp.trim()) {
      onDone("", "Enter authenticator code first.");
      return;
    }
    const body: Record<string, unknown> = {
      robloxAssetId: row.robloxAssetId,
      itemName: name.trim(),
      gameSource: gameSource.trim() || "ROBLOX_LIMITED",
      valueCoins: valueNum,
    };
    const c = catalogId.trim();
    if (c === "" || c === "-") {
      /* omit — backend keeps existing catalog id */
    } else if (c.toLowerCase() === "null" || c === "none") {
      body.robloxCatalogAssetId = null;
    } else if (/^\d+$/.test(c)) {
      body.robloxCatalogAssetId = c;
    } else {
      onDone("", "Roblox catalog id must be digits, empty, or null.");
      return;
    }
    setSaving(true);
    const res = await adminPost("/api/admin/set-item-value", body);
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      onDone("", typeof j.error === "string" ? j.error : "Save failed");
      return;
    }
    onDone(`Saved ${row.robloxAssetId}`, null);
  }

  return (
    <tr className="border-b border-border/60 align-top text-xs">
      <td className="max-w-[140px] px-1 py-1 font-mono text-[10px] text-text-secondary break-all">{row.robloxAssetId}</td>
      <td className="px-1 py-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full min-w-[100px] rounded border border-border bg-bg-tertiary px-1 py-0.5 text-text-primary"
        />
      </td>
      <td className="px-1 py-1">
        <input
          value={gameSource}
          onChange={(e) => setGameSource(e.target.value)}
          className="w-16 rounded border border-border bg-bg-tertiary px-1 py-0.5 text-text-primary"
        />
      </td>
      <td className="px-1 py-1">
        <input
          value={valueCoins}
          onChange={(e) => setValueCoins(e.target.value)}
          className="w-24 rounded border border-border bg-bg-tertiary px-1 py-0.5 text-text-primary"
        />
      </td>
      <td className="px-1 py-1">
        <input
          value={catalogId}
          onChange={(e) => setCatalogId(e.target.value)}
          placeholder="Roblox id"
          title="Numeric Roblox limited id; empty = unchanged; null = clear"
          className="w-full min-w-[88px] rounded border border-border bg-bg-tertiary px-1 py-0.5 font-mono text-[10px] text-text-primary"
        />
      </td>
      <td className="whitespace-nowrap px-1 py-1">
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveRow()}
          className="rounded bg-accent-cyan/90 px-2 py-0.5 text-[10px] font-bold text-[#0a0e14] disabled:opacity-50"
        >
          {saving ? "…" : "Save"}
        </button>
      </td>
    </tr>
  );
}

export default function AdminPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { user: me, isLoading } = useAuth();

  if (!mounted) return null;
  const [tab, setTab] = useState<Tab>("overview");
  const [totp, setTotp] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [stats, setStats] = useState<{ totalUsers: number; coinflipTax: number } | null>(null);
  const [userQ, setUserQ] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tradeStatus, setTradeStatus] = useState("");
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [logs, setLogs] = useState<AuditRow[]>([]);

  const [ivAsset, setIvAsset] = useState("");
  const [ivName, setIvName] = useState("");
  const [ivGame, setIvGame] = useState("ROBLOX_LIMITED");
  const [ivValue, setIvValue] = useState("");
  const [ivCatalog, setIvCatalog] = useState("");

  const [catalogItems, setCatalogItems] = useState<ItemValueRow[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogQ, setCatalogQ] = useState("");
  const [catalogSkip, setCatalogSkip] = useState(0);
  const [importBusy, setImportBusy] = useState(false);

  const [robloxSearchQ, setRobloxSearchQ] = useState("");
  const [robloxSearchBusy, setRobloxSearchBusy] = useState(false);
  const [robloxSearchHits, setRobloxSearchHits] = useState<
    { id: string; name: string; itemType: string; catalogUrl: string }[]
  >([]);

  const [adjUserId, setAdjUserId] = useState("");
  const [adjDelta, setAdjDelta] = useState("");
  const [adjNote, setAdjNote] = useState("");

  const [houseTax, setHouseTax] = useState("");
  const [jkMin, setJkMin] = useState("");
  const [cfMin, setCfMin] = useState("");

  const needsTotp = !!me?.adminTotpEnabled;

  const adminGet = useCallback(
    async (path: string) => {
      const headers: HeadersInit = {};
      if (needsTotp && totp.trim()) headers["X-Admin-TOTP"] = totp.trim();
      return apiFetch(path, { headers });
    },
    [needsTotp, totp],
  );

  const adminPost = useCallback(
    async (path: string, body: object) => {
      const init = withAdminTotp(
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        needsTotp ? totp : null,
      );
      return apiFetch(path, init);
    },
    [needsTotp, totp],
  );

  const loadOverview = useCallback(async () => {
    const r = await adminGet("/api/admin/revenue-stats");
    const j = await r.json().catch(() => ({}));
    if (r.ok) setStats({ totalUsers: j.totalUsers ?? 0, coinflipTax: j.coinflipTax ?? 0 });
  }, [adminGet]);

  const loadUsers = useCallback(async () => {
    const r = await adminGet(`/api/admin/users?q=${encodeURIComponent(userQ)}`);
    const j = await r.json().catch(() => ({}));
    if (r.ok) setUsers(j.users ?? []);
  }, [adminGet, userQ]);

  const loadTrades = useCallback(async () => {
    const q = tradeStatus ? `?status=${encodeURIComponent(tradeStatus)}` : "";
    const r = await adminGet(`/api/admin/trades${q}`);
    const j = await r.json().catch(() => ({}));
    if (r.ok) setTrades(j.trades ?? []);
  }, [adminGet, tradeStatus]);

  const loadAudit = useCallback(async () => {
    const r = await adminGet("/api/admin/audit-logs?take=100");
    const j = await r.json().catch(() => ({}));
    if (r.ok) setLogs(j.logs ?? []);
  }, [adminGet]);

  const loadCatalog = useCallback(async () => {
    if (needsTotp && !totp.trim()) return;
    const r = await adminGet(
      `/api/admin/item-values?take=200&skip=${catalogSkip}&q=${encodeURIComponent(catalogQ)}`,
    );
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      setCatalogItems((j.items as ItemValueRow[]) ?? []);
      setCatalogTotal((j.total as number) ?? 0);
    } else {
      setErr(typeof j.error === "string" ? j.error : "Failed to load catalog");
    }
  }, [adminGet, catalogQ, catalogSkip, needsTotp, totp]);

  useEffect(() => {
    setCatalogSkip(0);
  }, [catalogQ]);

  useEffect(() => {
    if (!me?.isAdmin) return;
    if (needsTotp && !totp.trim()) return;
    setErr(null);
    if (tab === "overview") void loadOverview();
    if (tab === "users") void loadUsers();
    if (tab === "trades") void loadTrades();
    if (tab === "audit") void loadAudit();
    if (tab === "values") void loadCatalog();
  }, [me?.isAdmin, needsTotp, totp, tab, loadOverview, loadUsers, loadTrades, loadAudit, loadCatalog]);

  function downloadSampleCatalogCsv() {
    const bom = "\uFEFF";
    const text = `${bom}robloxAssetId,itemName,gameSource,valueCoins,robloxCatalogAssetId
limited-classic-fedora,Classic Fedora,ROBLOX_LIMITED,5000,1365835
limited-bighead,Bighead,ROBLOX_LIMITED,8000,1048037
`;
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "item-values-sample.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importCatalogCsv(file: File | null) {
    if (!file) return;
    setImportBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const csv = await file.text();
      const res = await adminPost("/api/admin/import-item-values-csv", { csv });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const pe = j.parseErrors as { line: number; message: string }[] | undefined;
        const extra = pe?.length
          ? ` — ${pe
              .slice(0, 6)
              .map((p) => `line ${p.line}: ${p.message}`)
              .join("; ")}`
          : "";
        setErr((typeof j.error === "string" ? j.error : "Import failed") + extra);
        setImportBusy(false);
        return;
      }
      setMsg(`Imported ${(j.upserted as number) ?? 0} rows.`);
      await loadCatalog();
    } catch {
      setErr("Could not read file.");
    }
    setImportBusy(false);
  }

  async function runRobloxCatalogSearch() {
    const q = robloxSearchQ.trim();
    if (q.length < 2) {
      setErr("Type at least 2 characters to search Roblox.");
      setRobloxSearchHits([]);
      return;
    }
    if (needsTotp && !totp.trim()) {
      setErr("Enter authenticator code first.");
      return;
    }
    setRobloxSearchBusy(true);
    setErr(null);
    const r = await adminGet(`/api/admin/roblox-catalog-search?q=${encodeURIComponent(q)}&limit=30`);
    const j = await r.json().catch(() => ({}));
    setRobloxSearchBusy(false);
    if (!r.ok) {
      setErr(typeof j.error === "string" ? j.error : "Roblox search failed");
      setRobloxSearchHits([]);
      return;
    }
    const hits = (j.hits as { id: string; name: string; itemType: string; catalogUrl: string }[]) ?? [];
    setRobloxSearchHits(hits);
    setMsg(`Roblox catalog: ${hits.length} results — open links, confirm Tradable: Yes, then save.`);
  }

  async function setItemValue() {
    setMsg(null);
    setErr(null);
    const valueCoins = Number(ivValue);
    if (!ivAsset.trim() || !ivName.trim() || Number.isNaN(valueCoins)) {
      setErr("Fill asset id, name, and numeric value.");
      return;
    }
    const body: Record<string, unknown> = {
      robloxAssetId: ivAsset.trim(),
      itemName: ivName.trim(),
      gameSource: ivGame.trim() || "ROBLOX_LIMITED",
      valueCoins,
    };
    const c = ivCatalog.trim();
    if (c && /^\d+$/.test(c)) body.robloxCatalogAssetId = c;
    else if (c.toLowerCase() === "null" || c === "-") body.robloxCatalogAssetId = null;
    const res = await adminPost("/api/admin/set-item-value", body);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(typeof j.error === "string" ? j.error : "Request failed");
      return;
    }
    setMsg("Item value saved.");
    await loadCatalog();
  }

  async function banUser(uid: string, banned: boolean) {
    setMsg(null);
    setErr(null);
    const res = await adminPost("/api/admin/ban-user", { userId: uid, banned });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(typeof j.error === "string" ? j.error : "Ban failed");
      return;
    }
    setMsg(banned ? "User banned." : "User unbanned.");
    await loadUsers();
  }

  async function adjustBalance() {
    setMsg(null);
    setErr(null);
    const delta = Number(adjDelta);
    if (!adjUserId.trim() || Number.isNaN(delta) || delta === 0) {
      setErr("User id and non-zero delta required.");
      return;
    }
    const res = await adminPost("/api/admin/adjust-balance", {
      userId: adjUserId.trim(),
      deltaCoins: delta,
      note: adjNote.trim() || undefined,
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(typeof j.error === "string" ? j.error : j.error ?? "Adjust failed");
      return;
    }
    setMsg("Balance adjusted.");
    await loadUsers();
  }

  async function saveHouse() {
    setMsg(null);
    setErr(null);
    const payload: Record<string, number> = {};
    if (houseTax !== "") {
      const v = Number(houseTax);
      if (!Number.isNaN(v)) payload.houseTaxPercent = v;
    }
    if (jkMin !== "") {
      const v = Number(jkMin);
      if (!Number.isNaN(v)) payload.jackpotMinDeposit = v;
    }
    if (cfMin !== "") {
      const v = Number(cfMin);
      if (!Number.isNaN(v)) payload.coinflipMinValue = v;
    }
    if (Object.keys(payload).length === 0) {
      setErr("Enter at least one numeric setting.");
      return;
    }
    const res = await adminPost("/api/admin/configure-house-edge", payload);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(typeof j.error === "string" ? j.error : "Save failed");
      return;
    }
    setMsg("House settings stored in site config.");
  }

  if (isLoading) {
    return <p className="text-text-secondary">Loading…</p>;
  }

  if (!me) {
    return (
      <div className="rounded-xl border border-border bg-bg-secondary p-8 text-center">
        <p className="text-text-secondary">Log in to continue.</p>
        <Link href="/login" className="mt-4 inline-block text-accent-cyan hover:underline">
          Login
        </Link>
      </div>
    );
  }

  if (!me.isAdmin) {
    return (
      <div className="rounded-xl border border-border bg-bg-secondary p-8 text-center">
        <p className="text-text-secondary">You don't have admin access.</p>
        <Link href="/" className="mt-4 inline-block text-accent-cyan hover:underline">
          Home
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="font-display text-3xl font-bold text-text-primary">Admin</h1>
        <p className="mt-1 text-sm text-text-secondary">Manage users, item values, trades, and audit logs.</p>
        <p className="mt-2 text-sm">
          <Link href="/catalog-bot-guide" className="text-accent-cyan hover:underline">
            Catalog &amp; trade bot tutorial
          </Link>
        </p>
      </motion.div>

      {needsTotp && (
        <label className="block max-w-md rounded-xl border border-border bg-bg-secondary p-4 text-sm">
          <span className="font-medium text-text-primary">Authenticator code</span>
          <p className="mt-0.5 text-xs text-text-secondary">Required on every mutating action when admin 2FA is enabled.</p>
          <input
            value={totp}
            onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="6-digit TOTP"
            className="mt-2 w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-text-primary"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
        </label>
      )}

      {msg && <p className="rounded-lg bg-success/15 px-3 py-2 text-sm text-success">{msg}</p>}
      {err && <p className="rounded-lg bg-accent-red/15 px-3 py-2 text-sm text-accent-red">{err}</p>}

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {(
          [
            ["overview", "Overview"],
            ["users", "Users"],
            ["values", "Item values"],
            ["trades", "Trades"],
            ["audit", "Audit"],
            ["house", "House"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setTab(k);
              setMsg(null);
              setErr(null);
            }}
            className={`rounded-pill px-4 py-2 text-sm font-medium ${
              tab === k ? "bg-accent-cyan font-bold text-[#0a0e14]" : "bg-bg-secondary text-text-secondary hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && needsTotp && !totp.trim() && (
        <p className="text-sm text-text-secondary">Enter your authenticator code above to load admin data.</p>
      )}

      {tab === "overview" && stats && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-bg-secondary p-5">
            <p className="text-sm text-text-secondary">Registered users</p>
            <p className="font-display text-3xl font-bold text-text-primary">{stats.totalUsers}</p>
          </div>
          <div className="rounded-xl border border-border bg-bg-secondary p-5">
            <p className="text-sm text-text-secondary">Coinflip tax (sum)</p>
            <p className="font-display text-3xl font-bold text-accent-gold">◈ {Math.round(stats.coinflipTax).toLocaleString()}</p>
          </div>
        </div>
      )}

      {tab === "users" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <input
              value={userQ}
              onChange={(e) => setUserQ(e.target.value)}
              placeholder="Search username / roblox id"
              className="min-w-[200px] flex-1 rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary"
            />
            <button
              type="button"
              onClick={() => void loadUsers()}
              className="rounded-pill bg-bg-hover px-4 py-2 text-sm font-medium text-text-primary"
            >
              Search
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border bg-bg-secondary text-xs text-text-secondary">
                <tr>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Balance</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/60">
                    <td className="px-3 py-2">
                      <p className="font-medium text-text-primary">{u.username}</p>
                      <p className="font-mono text-[10px] text-text-secondary">{u.id.slice(0, 12)}…</p>
                    </td>
                    <td className="px-3 py-2 text-text-primary">◈ {Number(u.balanceCoins).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      {u.banned ? <span className="text-accent-red">Banned</span> : <span className="text-success">Active</span>}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => void banUser(u.id, !u.banned)}
                        className="text-xs text-accent-cyan hover:underline"
                      >
                        {u.banned ? "Unban" : "Ban"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-xl border border-border bg-bg-secondary p-4">
            <h3 className="font-medium text-text-primary">Adjust balance</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <input
                value={adjUserId}
                onChange={(e) => setAdjUserId(e.target.value)}
                placeholder="User id (cuid)"
                className="rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary"
              />
              <input
                value={adjDelta}
                onChange={(e) => setAdjDelta(e.target.value)}
                placeholder="Delta coins (+/-)"
                className="rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary"
              />
              <input
                value={adjNote}
                onChange={(e) => setAdjNote(e.target.value)}
                placeholder="Note (optional)"
                className="rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <button
              type="button"
              onClick={() => void adjustBalance()}
              className="mt-3 rounded-xl bg-accent-cyan px-4 py-2 text-sm font-bold text-[#0a0e14]"
            >
              Apply adjustment
            </button>
          </div>
        </div>
      )}

      {tab === "values" && needsTotp && !totp.trim() && (
        <p className="text-sm text-text-secondary">Enter your authenticator code to load the catalog grid.</p>
      )}

      {tab === "values" && (!needsTotp || totp.trim()) && (
        <div className="space-y-6">
          <div className="max-w-xl space-y-4 rounded-xl border border-border bg-bg-secondary p-5">
            <p className="text-sm text-text-secondary">
              Quick add / update one row. For bulk edits use the grid below or CSV. Numeric{" "}
              <strong className="text-text-primary">Roblox catalog id</strong> is required for real withdrawals when the site id is a slug (e.g.{" "}
              <code className="text-accent-cyan">limited-*</code>). Leave catalog blank to skip updating that field.
            </p>
            <p className="text-xs text-amber-200/90">
              Always open <strong>Roblox page</strong> from catalog lookup and confirm the item shows <strong>Tradable: Yes</strong> before saving its catalog ID.
            </p>
            <input
              value={ivAsset}
              onChange={(e) => setIvAsset(e.target.value)}
              placeholder="Site robloxAssetId (e.g. limited-sparkle-time-fedora)"
              className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary"
            />
            <input
              value={ivName}
              onChange={(e) => setIvName(e.target.value)}
              placeholder="Display name"
              className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary"
            />
            <input
              value={ivGame}
              onChange={(e) => setIvGame(e.target.value)}
              placeholder="gameSource (e.g. ROBLOX_LIMITED)"
              className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary"
            />
            <input
              value={ivValue}
              onChange={(e) => setIvValue(e.target.value)}
              placeholder="Value (coins)"
              className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary"
            />
            <input
              value={ivCatalog}
              onChange={(e) => setIvCatalog(e.target.value)}
              placeholder="Roblox catalog asset id (digits), empty = no change, null = clear"
              className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 font-mono text-sm text-text-primary"
            />
            <button
              type="button"
              onClick={() => void setItemValue()}
              className="rounded-xl bg-accent-cyan px-5 py-2 text-sm font-bold text-[#0a0e14]"
            >
              Save value
            </button>
          </div>

          <div className="rounded-xl border border-border bg-bg-secondary p-5">
            <h2 className="font-display text-lg font-bold text-text-primary">Roblox catalog lookup</h2>
            <p className="mt-1 text-xs text-text-secondary">
              Queries Roblox&apos;s public catalog API (same catalog as the website). Names can be ambiguous — always{" "}
              <strong className="text-text-primary">open the link</strong> and confirm you have the correct{" "}
              <strong className="text-text-primary">limited / tradable asset</strong> before pasting the id into your row.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={robloxSearchQ}
                onChange={(e) => setRobloxSearchQ(e.target.value)}
                placeholder='Try: "Sparkle Time Fedora" or "Domino Crown"'
                className="min-w-[200px] flex-1 rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runRobloxCatalogSearch();
                }}
              />
              <button
                type="button"
                disabled={robloxSearchBusy}
                onClick={() => void runRobloxCatalogSearch()}
                className="rounded-pill bg-bg-hover px-4 py-2 text-sm font-medium text-text-primary disabled:opacity-50"
              >
                {robloxSearchBusy ? "Searching…" : "Search Roblox"}
              </button>
            </div>
            {robloxSearchHits.length > 0 && (
              <ul className="mt-4 max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border/60 bg-bg-tertiary/30">
                {robloxSearchHits.map((h) => (
                  <li
                    key={h.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/40 px-3 py-2 text-xs last:border-0"
                  >
                    <span className="shrink-0 font-mono text-accent-cyan">{h.id}</span>
                    <span className="min-w-0 flex-1 text-text-primary">{h.name}</span>
                    <span className="shrink-0 text-text-secondary">{h.itemType}</span>
                    <a
                      href={h.catalogUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-accent-cyan hover:underline"
                    >
                      Roblox page
                    </a>
                    <button
                      type="button"
                      className="shrink-0 text-accent-cyan hover:underline"
                      onClick={() => {
                        void navigator.clipboard?.writeText(h.id);
                        setMsg(`Copied id ${h.id}`);
                      }}
                    >
                      Copy id
                    </button>
                    <button
                      type="button"
                      className="shrink-0 text-accent-cyan hover:underline"
                      onClick={() => {
                        setIvCatalog(h.id);
                        setMsg(`Filled quick form catalog id (${h.id}). Save when ready.`);
                      }}
                    >
                      Use in quick form
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-border bg-bg-secondary p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <h2 className="font-display text-lg font-bold text-text-primary">Catalog grid</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => downloadSampleCatalogCsv()}
                  className="rounded-pill border border-border bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-primary"
                >
                  Download sample CSV
                </button>
                <label className="cursor-pointer rounded-xl bg-accent-cyan px-3 py-1.5 text-xs font-bold text-[#0a0e14]">
                  {importBusy ? "Importing…" : "Import CSV"}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    disabled={importBusy}
                    onChange={(e) => void importCatalogCsv(e.target.files?.[0] ?? null)}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void loadCatalog()}
                  className="rounded-pill border border-border bg-bg-hover px-3 py-1.5 text-xs text-text-primary"
                >
                  Refresh grid
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-text-secondary">
              CSV columns: <code className="text-accent-cyan">robloxAssetId</code>, <code className="text-accent-cyan">itemName</code>,{" "}
              <code className="text-accent-cyan">valueCoins</code>, optional <code className="text-accent-cyan">gameSource</code>,{" "}
              <code className="text-accent-cyan">robloxCatalogAssetId</code>. Empty catalog cell = leave unchanged on update.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={catalogQ}
                onChange={(e) => setCatalogQ(e.target.value)}
                placeholder="Search asset id or name"
                className="min-w-[180px] flex-1 rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary"
              />
              <span className="text-xs text-text-secondary">
                Showing {catalogItems.length ? catalogSkip + 1 : 0}–{catalogSkip + catalogItems.length} of {catalogTotal}
              </span>
              <button
                type="button"
                disabled={catalogSkip === 0}
                onClick={() => setCatalogSkip((s) => Math.max(0, s - 200))}
                className="rounded-lg border border-border px-2 py-1 text-xs text-text-primary disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={catalogSkip + catalogItems.length >= catalogTotal}
                onClick={() => setCatalogSkip((s) => s + 200)}
                className="rounded-lg border border-border px-2 py-1 text-xs text-text-primary disabled:opacity-40"
              >
                Next
              </button>
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[720px] text-left">
                <thead className="border-b border-border bg-bg-tertiary text-[10px] text-text-secondary">
                  <tr>
                    <th className="px-1 py-2">Site asset id</th>
                    <th className="px-1 py-2">Name</th>
                    <th className="px-1 py-2">Game</th>
                    <th className="px-1 py-2">Coins</th>
                    <th className="px-1 py-2">Roblox catalog #</th>
                    <th className="px-1 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {catalogItems.map((row) => (
                    <CatalogEditableRow
                      key={row.robloxAssetId}
                      row={row}
                      adminPost={adminPost}
                      needsTotp={needsTotp}
                      totp={totp}
                      onDone={(m, e) => {
                        if (e) setErr(e);
                        else {
                          setMsg(m);
                          setErr(null);
                          void loadCatalog();
                        }
                      }}
                    />
                  ))}
                </tbody>
              </table>
              {catalogItems.length === 0 && <p className="p-4 text-sm text-text-secondary">No rows (try Refresh or relax search).</p>}
            </div>
          </div>
        </div>
      )}

      {tab === "trades" && (
        <div className="space-y-3">
          <select
            value={tradeStatus}
            onChange={(e) => setTradeStatus(e.target.value)}
            className="rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary"
          >
            <option value="">All statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="OFFER_SENT">OFFER_SENT</option>
            <option value="ACCEPTED">ACCEPTED</option>
            <option value="FAILED">FAILED</option>
            <option value="TIMEOUT">TIMEOUT</option>
          </select>
          <button
            type="button"
            onClick={() => void loadTrades()}
            className="ml-2 rounded-pill bg-bg-hover px-3 py-2 text-sm text-text-primary"
          >
            Refresh
          </button>
          <ul className="max-h-[480px] space-y-2 overflow-y-auto text-sm">
            {trades.map((t) => (
              <li key={t.id} className="rounded-lg border border-border bg-bg-secondary px-3 py-2">
                <span className="font-mono text-[10px] text-text-secondary">{t.id.slice(0, 10)}…</span> · {t.direction} ·{" "}
                {t.status} · {t.user?.username} · bot {t.bot?.robloxUsername}
              </li>
            ))}
            {trades.length === 0 && <li className="text-text-secondary">No trades.</li>}
          </ul>
        </div>
      )}

      {tab === "audit" && (
        <ul className="max-h-[520px] space-y-2 overflow-y-auto font-mono text-xs text-text-secondary">
          {logs.map((l) => (
            <li key={l.id} className="rounded border border-border/60 bg-bg-secondary px-2 py-1.5">
              {l.createdAt} · {l.action} · {l.targetType ?? "—"} · {l.targetId?.slice(0, 8) ?? "—"}
            </li>
          ))}
          {logs.length === 0 && <li>No logs.</li>}
        </ul>
      )}

      {tab === "house" && (
        <div className="max-w-md space-y-4 rounded-xl border border-border bg-bg-secondary p-5">
          <p className="text-sm text-text-secondary">
            Writes to <code className="text-accent-cyan">site_config</code>. Restart or reload config in app if you add runtime reads later.
          </p>
          <label className="block text-sm">
            House tax %
            <input
              value={houseTax}
              onChange={(e) => setHouseTax(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-text-primary"
              placeholder="e.g. 5"
            />
          </label>
          <label className="block text-sm">
            Jackpot min deposit
            <input
              value={jkMin}
              onChange={(e) => setJkMin(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-text-primary"
            />
          </label>
          <label className="block text-sm">
            Coinflip min value
            <input
              value={cfMin}
              onChange={(e) => setCfMin(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-text-primary"
            />
          </label>
          <button
            type="button"
            onClick={() => void saveHouse()}
            className="rounded-xl bg-accent-cyan px-5 py-2 text-sm font-bold text-[#0a0e14]"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
