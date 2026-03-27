import fs from "node:fs";
import path from "node:path";
import Link from "next/link";

export default function CatalogBotGuidePage() {
  let content = "";
  try {
    const p = path.join(process.cwd(), "..", "docs", "CATALOG_AND_BOT_TUTORIAL.md");
    content = fs.readFileSync(p, "utf8");
  } catch {
    content =
      "Could not read docs/CATALOG_AND_BOT_TUTORIAL.md. Open that file in your project folder (repo root → docs).";
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/admin" className="font-semibold text-accent-cyan hover:underline">
          ← Admin
        </Link>
        <Link href="/" className="text-text-secondary hover:text-accent-cyan">
          Home
        </Link>
      </div>
      <h1 className="font-display text-3xl font-bold text-text-primary">Catalog &amp; trade bot guide</h1>
      <p className="text-sm text-text-secondary">
        Beginner steps for filling <code className="text-accent-cyan">item_values</code>, CSV import, and configuring the Roblox trade bot.
      </p>
      <article className="whitespace-pre-wrap rounded-2xl border border-border-default bg-bg-secondary/95 p-6 font-mono text-xs leading-relaxed text-text-primary shadow-card md:text-sm">
        {content}
      </article>
    </div>
  );
}
