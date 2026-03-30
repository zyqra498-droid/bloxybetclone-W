"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { RequireAuth } from "@/components/RequireAuth";
import { BloxyPageHeader } from "@/components/bloxy/BloxyPageHeader";

type Row = { id: string; type: string; title: string; body: string; read: boolean; createdAt: string };

function NotificationsContent() {
  const [rows, setRows] = useState<Row[]>([]);

  async function load() {
    const r = await apiFetch("/api/notifications");
    if (!r.ok) return;
    const d = await r.json();
    setRows(d.notifications ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function markAll() {
    await apiFetch("/api/notifications/read-all", { method: "POST", body: "{}" });
    await load();
  }

  return (
    <div className="space-y-8">
      <BloxyPageHeader title="Notifications" subtitle="Trade updates, game results, and system alerts." eyebrow="Inbox">
        <button
          type="button"
          onClick={() => void markAll()}
          className="rounded-xl border border-border-default bg-bg-tertiary px-4 py-2 text-sm font-semibold text-text-primary transition hover:border-accent-cyan/30"
        >
          Mark all read
        </button>
      </BloxyPageHeader>

      <Link href="/wallet" className="text-sm font-semibold text-accent-cyan hover:underline">
        ← Wallet
      </Link>

      <ul className="space-y-3">
        {rows.map((n) => (
          <li
            key={n.id}
            className={`rounded-2xl border border-border-default p-4 shadow-card ${
              n.read ? "bg-bg-secondary/50 opacity-75" : "bg-bg-secondary/95"
            }`}
          >
            <p className="font-semibold text-text-primary">{n.title}</p>
            <p className="mt-1 text-sm text-text-secondary">{n.body}</p>
            <p className="mt-2 text-xs text-text-muted">{new Date(n.createdAt).toLocaleString()}</p>
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p className="text-text-secondary">No notifications yet.</p>}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <NotificationsContent />
    </RequireAuth>
  );
}
