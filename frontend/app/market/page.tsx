"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  catalogRowToMarketItem,
  type LimitedCategory,

  type LimitedTier,
  type MarketItemDisplay,
  getRobloxItemImageUrl,
  LIMITED_PLACEHOLDER_PATH,
  thumbnailSrcForCatalog,
} from "@/lib/robloxLimiteds";
import { ItemCard } from "@/components/ItemCard";
import { useDebouncedValue } from "@/hooks/useDebounced";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatCoins } from "@/lib/format";
import type { SiteItem } from "@/lib/types";
import Link from "next/link";
import { getSocket } from "@/lib/socket";
import { BloxyPageHeader } from "@/components/bloxy/BloxyPageHeader";

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

type CatalogRow = {
  robloxAssetId: string;
  itemName: string;
  gameSource: string;
  valueCoins: number;
  robloxCatalogAssetId?: string | null;
};

type Tab = "browse" | "inventory" | "trades" | "values";

const TIERS: LimitedTier[] = ["common", "rare", "epic", "legendary", "mythic"];
const CATEGORIES: LimitedCategory[] = ["hat", "face", "accessory", "gear"];

const CATEGORY_LABEL: Record<LimitedCategory, string> = {
  hat: "Hat",
  face: "Face",
  accessory: "Accessory",
  gear: "Gear",
};

export default function MarketPage() {
  const { isLoggedIn } = useAuth();
  const [tab, setTab] = useState<Tab>("browse");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [tierSel, setTierSel] = useState<Set<LimitedTier>>(new Set());
  const [categorySel, setCategorySel] = useState<LimitedCategory | "all">("all");
  const [sort, setSort] = useState<"value-desc" | "value-asc" | "name" | "demand">("value-desc");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 3_000_000]);
  const [myOnly, setMyOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MarketItemDisplay | null>(null);
  const [catalogRows, setCatalogRows] = useState<CatalogRow[]>([]);
  const [inventory, setInventory] = useState<SiteItem[]>([]);
  const [trades, setTrades] = useState<{ id: string; direction: string; username: string; completedAt: string | null }[]>(
    [],
  );
  const [chartPoints, setChartPoints] = useState<{ date: string; value: number }[]>([]);
  const [detailOpenMobile, setDetailOpenMobile] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const merged: MarketItemDisplay[] = useMemo(() => catalogRows.map(catalogRowToMarketItem), [catalogRows]);

  useEffect(() => {
    fetch("/api/catalog/item-values", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setCatalogRows(d.items ?? []))
      .catch(() => {});
  }, []);

  const refreshInventory = useCallback(() => {
    if (!isLoggedIn) return;
    void apiFetch("/api/inventory/deposited")
      .then((r) => (r.ok ? r.json().then((d: { items?: SiteItem[] }) => setInventory(d.items ?? [])) : null))
      .catch(() => {
        /* apiFetch resolves 503 on network error; this catches JSON parse edge cases */
      });
  }, [isLoggedIn]);

  useEffect(() => {
    refreshInventory();
  }, [isLoggedIn, tab, refreshInventory]);

  useEffect(() => {
    const s = getSocket();
    const onSync = () => refreshInventory();
    s.on("inventory:sync", onSync);
    return () => {
      s.off("inventory:sync", onSync);
    };
  }, [refreshInventory]);

  useEffect(() => {
    fetch("/api/stats/recent-trades", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setTrades(d.trades ?? []))
      .catch(() => {});
  }, [tab]);

  useEffect(() => {
    const s = getSocket();
    const onTrade = () => {
      fetch("/api/stats/recent-trades", { credentials: "include" })
        .then((r) => r.json())
        .then((d) => setTrades(d.trades ?? []))
        .catch(() => {});
    };
    s.on("trade:update", onTrade);
    return () => {
      s.off("trade:update", onTrade);
    };
  }, []);

  const filtered = useMemo(() => {
    let list = merged.filter((m) => {
      if (debouncedSearch && !m.name.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
      if (tierSel.size > 0 && !tierSel.has(m.tier)) return false;
      if (categorySel !== "all" && m.category !== categorySel) return false;
      if (m.valueCoins < priceRange[0] || m.valueCoins > priceRange[1]) return false;
      if (myOnly && isLoggedIn) {
        const have = inventory.some((i) => i.itemName.toLowerCase() === m.name.toLowerCase());
        if (!have) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "value-desc") return b.valueCoins - a.valueCoins;
      if (sort === "value-asc") return a.valueCoins - b.valueCoins;
      if (sort === "name") return a.name.localeCompare(b.name);
      return b.demand - a.demand;
    });
    return list;
  }, [merged, debouncedSearch, tierSel, categorySel, sort, priceRange, myOnly, isLoggedIn, inventory]);

  const pageSize = 48;
  const slice = filtered.slice(0, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, tierSel, categorySel, sort, priceRange, myOnly]);

  useEffect(() => {
    const sel = selected;
    if (!sel) {
      setChartPoints([]);
      return;
    }
    let cancelled = false;
    async function load() {
      if (!sel) return;
      const r = await fetch(`/api/catalog/item-values/${encodeURIComponent(sel.robloxAssetId)}/history`, {
        credentials: "include",
      });
      if (r.ok) {
        const d = await r.json();
        if (!cancelled && d.points?.length) {
          setChartPoints(d.points.map((p: { date: string; value: number }) => ({ date: p.date, value: p.value })));
          return;
        }
      }
      const base = sel.valueCoins;
      const pts: { date: string; value: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        pts.push({
          date: d.toISOString(),
          value: Math.round(base * (0.92 + (i % 7) * 0.01)),
        });
      }
      if (!cancelled) setChartPoints(pts);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const toggleTier = (t: LimitedTier) => {
    setTierSel((prev) => {
      const n = new Set(prev);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });
  };

  const onScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      if (el.scrollHeight - el.scrollTop < el.clientHeight + 120) {
        if (slice.length < filtered.length) setPage((p) => p + 1);
      }
    },
    [slice.length, filtered.length],
  );

  return (
    <div className="space-y-6">
      <BloxyPageHeader
        title="Marketplace"
        subtitle="Roblox Limiteds with site-backed ◈ values — tap an item for Past 30d sales, deposit to wallet, or jump into games."
        eyebrow="0% fee catalog"
      />

      <div className="sticky top-0 z-20 -mx-4 border-b border-border-default bg-bg-primary/95 px-4 py-3 backdrop-blur-xl md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["browse", "Browse"],
              ["inventory", "My inventory"],
              ["trades", "Recent trades"],
              ["values", "Values"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                tab === k
                  ? "bg-accent-cyan font-bold text-[#0a0e14] shadow-glow-cyan"
                  : "border border-border-default bg-bg-secondary text-text-secondary hover:border-accent-cyan/20"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "browse" && (
        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_minmax(280px,340px)]">
          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-4 rounded-2xl border border-border-default bg-bg-secondary/90 p-4 shadow-card">
              <p className="font-display text-sm font-bold text-text-primary">Filters</p>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-xl border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary"
              />
              <p className="text-xs font-semibold text-text-secondary">Tier</p>
              <div className="flex flex-wrap gap-1">
                {TIERS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTier(t)}
                    className={`rounded-xl px-2 py-1 text-xs capitalize ${
                      tierSel.has(t) ? "bg-accent-cyan font-bold text-[#0a0e14]" : "bg-bg-tertiary text-text-secondary"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="text-xs font-semibold text-text-secondary">Category</p>
              <select
                value={categorySel}
                onChange={(e) => setCategorySel(e.target.value as LimitedCategory | "all")}
                className="w-full rounded-xl border border-border-default bg-bg-tertiary px-2 py-2 text-sm text-text-primary"
              >
                <option value="all">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="w-full rounded-xl border border-border-default bg-bg-tertiary px-2 py-2 text-sm text-text-primary"
              >
                <option value="value-desc">Value high → low</option>
                <option value="value-asc">Value low → high</option>
                <option value="name">Name</option>
                <option value="demand">Demand</option>
              </select>
              <label className="text-xs text-text-secondary">
                Price range: {formatCoins(priceRange[0])} – {formatCoins(priceRange[1])}
              </label>
              <input
                type="range"
                min={0}
                max={3_000_000}
                step={5000}
                value={priceRange[1]}
                onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                className="w-full"
              />
              {isLoggedIn && (
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input type="checkbox" checked={myOnly} onChange={(e) => setMyOnly(e.target.checked)} />
                  My items only
                </label>
              )}
            </div>
          </aside>

          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="w-full rounded-xl border border-border-default bg-bg-secondary py-3 text-sm font-semibold text-text-primary"
            >
              Filters & search
            </button>
          </div>

          <div
            className="max-h-[calc(100dvh-220px)] overflow-y-auto lg:max-h-[calc(100dvh-180px)]"
            onScroll={onScroll}
          >
            {slice.length === 0 ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-20 text-center text-text-secondary">
                No items match filters.
              </motion.div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {slice.map((m, i) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: Math.min(i, 20) * 0.02 }}
                  >
                    <ItemCard
                      item={m}
                      selected={selected?.id === m.id}
                      onSelect={() => {
                        setSelected(m);
                        setDetailOpenMobile(true);
                      }}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          <aside className="hidden lg:block">
            {selected ? (
              <DetailPanel
                item={selected}
                chartPoints={chartPoints}
                onClose={() => setSelected(null)}
                isLoggedIn={isLoggedIn}
                onDeposited={refreshInventory}
              />
            ) : (
              <p className="rounded-2xl border border-border-default bg-bg-secondary/80 p-6 text-sm text-text-secondary shadow-card">
                Select an item to view value history and actions.
              </p>
            )}
          </aside>
        </div>
      )}

      {tab === "inventory" && (
        <div>
          {!isLoggedIn ? (
            <p className="text-text-secondary">
              <Link href="/login" className="font-semibold text-accent-cyan underline">
                Log in
              </Link>{" "}
              to view inventory.
            </p>
          ) : inventory.length === 0 ? (
            <p className="text-text-secondary">No deposited items.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {inventory.map((it) => {
                const src =
                  it.imageUrl ||
                  (/^\d+$/.test(String(it.robloxAssetId).trim())
                    ? getRobloxItemImageUrl(String(it.robloxAssetId).trim())
                    : LIMITED_PLACEHOLDER_PATH);
                return (
                  <div key={it.id} className="rounded-xl border border-border-default bg-bg-secondary p-3">
                    <div className="relative mx-auto flex aspect-square w-full max-w-[140px] items-center justify-center overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt=""
                        crossOrigin="anonymous"
                        className="max-h-full max-w-full object-contain p-1"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = LIMITED_PLACEHOLDER_PATH;
                        }}
                      />
                    </div>
                    <p className="mt-2 font-medium text-text-primary">{it.itemName}</p>
                    <p className="font-display text-accent-gold">◈ {formatCoins(it.valueCoins)}</p>
                    <span className="text-xs text-text-secondary">{it.status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "trades" && (
        <ul className="space-y-2">
          {trades.map((t) => (
            <li key={t.id} className="rounded-xl border border-border-default bg-bg-secondary/90 px-3 py-2 text-sm">
              <span className="text-accent-gold">{t.username}</span> · {t.direction} ·{" "}
              {t.completedAt ? new Date(t.completedAt).toLocaleString() : "—"}
            </li>
          ))}
          {trades.length === 0 && <li className="text-text-secondary">No recent trades.</li>}
        </ul>
      )}

      {tab === "values" && (
        <div className="overflow-x-auto rounded-2xl border border-border-default shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg-secondary text-text-secondary">
              <tr>
                <th className="p-3 w-16" aria-label="Preview" />
                <th className="p-3">Item</th>
                <th className="p-3">Source</th>
                <th className="p-3">Value (◈)</th>
              </tr>
            </thead>
            <tbody>
              {catalogRows.slice(0, 100).map((r) => (
                <tr key={r.robloxAssetId} className="border-t border-border-default">
                  <td className="p-3 align-middle">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumbnailSrcForCatalog(r.robloxCatalogAssetId)}
                        alt=""
                        crossOrigin="anonymous"
                        className="max-h-12 max-w-12 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = LIMITED_PLACEHOLDER_PATH;
                        }}
                      />
                    </div>
                  </td>
                  <td className="p-3 text-text-primary">{r.itemName}</td>
                  <td className="p-3 text-text-secondary">{r.gameSource}</td>
                  <td className="p-3 font-display text-accent-gold">{formatCoins(r.valueCoins)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {catalogRows.length === 0 && <p className="p-4 text-text-secondary">No admin values yet.</p>}
        </div>
      )}

      <AnimatePresence>
        {filtersOpen && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl border border-border-default bg-bg-secondary p-4 lg:hidden"
          >
            <div className="mb-3 flex justify-between">
              <span className="font-display font-bold">Filters</span>
              <button type="button" onClick={() => setFiltersOpen(false)} className="text-text-secondary">
                ✕
              </button>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="mb-3 w-full rounded-xl border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary"
            />
            <p className="mb-1 text-xs text-text-secondary">Tier</p>
            <div className="mb-3 flex flex-wrap gap-1">
              {TIERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTier(t)}
                  className={`rounded-pill px-2 py-1 text-xs capitalize ${
                    tierSel.has(t) ? "bg-accent-cyan font-bold text-[#0a0e14]" : "bg-bg-tertiary text-text-secondary"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <select
              value={categorySel}
              onChange={(e) => setCategorySel(e.target.value as LimitedCategory | "all")}
              className="mb-3 w-full rounded-xl border border-border-default bg-bg-tertiary px-2 py-2 text-sm text-text-primary"
            >
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="w-full rounded-xl bg-accent-cyan py-3 text-sm font-bold text-[#0a0e14] shadow-glow-cyan"
              onClick={() => setFiltersOpen(false)}
            >
              Apply
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detailOpenMobile && selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end bg-black/70 lg:hidden"
            onClick={() => setDetailOpenMobile(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl border border-border-default bg-bg-secondary p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <DetailPanel
                item={selected}
                chartPoints={chartPoints}
                onClose={() => setDetailOpenMobile(false)}
                isLoggedIn={isLoggedIn}
                onDeposited={refreshInventory}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailPanel({
  item,
  chartPoints,
  onClose,
  isLoggedIn,
  onDeposited,
}: {
  item: MarketItemDisplay;
  chartPoints: { date: string; value: number }[];
  onClose: () => void;
  isLoggedIn: boolean;
  onDeposited: () => void;
}) {
  const [heroSrc, setHeroSrc] = useState(() => thumbnailSrcForCatalog(item.robloxCatalogAssetId));
  useEffect(() => {
    setHeroSrc(thumbnailSrcForCatalog(item.robloxCatalogAssetId));
  }, [item.robloxCatalogAssetId]);

  const [depLoading, setDepLoading] = useState(false);
  const [depErr, setDepErr] = useState<string | null>(null);
  const [depOk, setDepOk] = useState<string | null>(null);

  const avgVol = useMemo(() => {
    if (!chartPoints.length) return Math.round(item.valueCoins);
    return Math.round(chartPoints.reduce((a, p) => a + p.value, 0) / chartPoints.length);
  }, [chartPoints, item.valueCoins]);

  async function depositToWallet() {
    setDepErr(null);
    setDepOk(null);
    setDepLoading(true);
    try {
      const payload = { robloxAssetId: item.robloxAssetId };
      const res = await apiFetch("/api/inventory/catalog-deposit", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const j = (await res.json().catch(() => ({}))) as unknown;
      if (!res.ok) {
        setDepErr(apiErrorMessage(j, "Could not add to inventory."));
        return;
      }
      setDepOk("Added to your site inventory. You can use it in games or see it under Wallet / My inventory.");
      onDeposited();
    } catch {
      setDepErr("Could not complete deposit. Check your connection and that the API is running.");
    } finally {
      setDepLoading(false);
    }
  }

  return (
    <div className="sticky top-20 space-y-4 rounded-2xl border border-border-default bg-bg-secondary/95 p-5 shadow-card">
      <div className="flex justify-between gap-2">
        <h2 className="font-display text-xl font-bold text-text-primary">{item.name}</h2>
        <button
          type="button"
          className="rounded-lg px-2 text-lg text-text-secondary transition hover:bg-bg-hover hover:text-text-primary lg:hidden"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div className="relative mx-auto flex aspect-square max-w-[200px] items-center justify-center rounded-xl border border-border-default bg-bg-tertiary/40 p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroSrc}
          alt={item.name}
          crossOrigin="anonymous"
          className="max-h-[200px] max-w-full object-contain"
          onError={() => setHeroSrc(LIMITED_PLACEHOLDER_PATH)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border-default bg-bg-tertiary/60 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">30d vol</p>
          <p className="font-display text-base font-bold tabular-nums text-text-primary">{chartPoints.length} points</p>
        </div>
        <div className="rounded-xl border border-border-default bg-bg-tertiary/60 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Site value</p>
          <p className="font-display text-base font-bold tabular-nums text-accent-cyan">◈ {formatCoins(item.valueCoins)}</p>
        </div>
      </div>
      <p className="text-xs text-text-secondary">
        Avg over chart: <span className="font-display font-semibold text-accent-cyan">◈ {formatCoins(avgVol)}</span>
      </p>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-text-muted">Past 30d sales</p>
        <div className="h-52 w-full rounded-xl border border-border-default bg-bg-primary/35 p-2">
          {chartPoints.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-text-muted">No history yet — showing placeholder trend.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartPoints} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  stroke="rgba(255,255,255,0.08)"
                />
                <YAxis
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  stroke="rgba(255,255,255,0.08)"
                  tickFormatter={(v) => formatCoins(Number(v))}
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1e1f23",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                  labelFormatter={(v) => new Date(v as string).toLocaleString()}
                  formatter={(value) => {
  if (value === undefined || value === null) return ['', ''];
  return [`◈ ${formatCoins(Number(value))}`, ''];
}}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#60a5fa", stroke: "#1e40af" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      {depErr && <p className="rounded-xl border border-accent-red/30 bg-accent-red/10 px-3 py-2 text-sm text-accent-red">{depErr}</p>}
      {depOk && <p className="rounded-xl border border-accent-cyan/25 bg-accent-cyan/10 px-3 py-2 text-sm text-accent-cyan">{depOk}</p>}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {!isLoggedIn ? (
          <Link
            href="/login"
            className="inline-flex justify-center rounded-xl bg-accent-cyan px-4 py-2.5 text-center text-sm font-bold text-[#0a0e14] shadow-glow-cyan"
          >
            Log in to deposit
          </Link>
        ) : (
          <button
            type="button"
            disabled={depLoading}
            onClick={() => void depositToWallet()}
            className="rounded-xl bg-accent-cyan px-4 py-2.5 text-sm font-bold text-[#0a0e14] shadow-glow-cyan disabled:opacity-50"
          >
            {depLoading ? "Adding…" : "Add to cart · deposit"}
          </button>
        )}
        <Link
          href="/wallet"
          className="rounded-xl border border-border-default bg-bg-tertiary px-4 py-2.5 text-center text-sm font-semibold text-text-primary"
        >
          Wallet
        </Link>
        <Link href="/coinflip" className="rounded-xl border border-border-default px-4 py-2.5 text-center text-sm font-medium text-text-secondary">
          Coinflip
        </Link>
        <Link href="/jackpot" className="rounded-xl border border-border-default px-4 py-2.5 text-center text-sm font-medium text-text-secondary">
          Jackpot
        </Link>
      </div>
    </div>
  );
}
