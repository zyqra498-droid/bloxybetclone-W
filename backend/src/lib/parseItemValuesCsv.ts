/** Minimal CSV (comma, optional quotes, CRLF) for admin catalog import. */

export type ParsedItemValueRow = {
  line: number;
  robloxAssetId: string;
  itemName: string;
  gameSource: string;
  valueCoins: number;
  /** omit = leave DB unchanged; null = clear; string = set */
  robloxCatalogAssetId: "omit" | null | string;
};

function parseCsvGrid(text: string): string[][] {
  const s = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n") {
      row.push(cur);
      cur = "";
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = [];
    } else {
      cur += c;
    }
  }
  row.push(cur);
  if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
  return rows;
}

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "");
}

export function parseItemValuesCsv(text: string, maxRows = 2500): { rows: ParsedItemValueRow[]; errors: { line: number; message: string }[] } {
  const grid = parseCsvGrid(text);
  const errors: { line: number; message: string }[] = [];
  if (grid.length < 2) {
    errors.push({ line: 0, message: "CSV needs a header row and at least one data row." });
    return { rows: [], errors };
  }

  const header = grid[0]!.map((c) => normHeader(c));
  const idx = (name: string) => header.indexOf(normHeader(name));

  const iAsset = idx("robloxAssetId");
  const iName = idx("itemName");
  const iGame = idx("gameSource");
  const iVal = idx("valueCoins");
  const iCat = idx("robloxCatalogAssetId");

  if (iAsset < 0) errors.push({ line: 1, message: "Missing required column: robloxAssetId" });
  if (iName < 0) errors.push({ line: 1, message: "Missing required column: itemName" });
  if (iVal < 0) errors.push({ line: 1, message: "Missing required column: valueCoins" });
  if (errors.length > 0) return { rows: [], errors };

  const hasCatCol = iCat >= 0;
  const out: ParsedItemValueRow[] = [];
  const limit = Math.min(grid.length - 1, maxRows);

  for (let r = 1; r <= limit; r++) {
    const line = r + 1;
    const g = grid[r]!;
    const robloxAssetId = (g[iAsset] ?? "").trim();
    const itemName = (g[iName] ?? "").trim();
    const gameSource = (iGame >= 0 ? (g[iGame] ?? "").trim() : "") || "ROBLOX_LIMITED";
    const valRaw = (g[iVal] ?? "").trim();
    const catRaw = hasCatCol ? (g[iCat] ?? "").trim() : "";

    if (!robloxAssetId && !itemName && !valRaw) continue;

    if (!robloxAssetId) {
      errors.push({ line, message: "robloxAssetId empty" });
      continue;
    }
    if (!itemName) {
      errors.push({ line, message: "itemName empty" });
      continue;
    }
    const valueCoins = Number(valRaw.replace(/,/g, ""));
    if (!Number.isFinite(valueCoins) || valueCoins < 0) {
      errors.push({ line, message: "valueCoins must be a non-negative number" });
      continue;
    }

    let robloxCatalogAssetId: ParsedItemValueRow["robloxCatalogAssetId"] = "omit";
    if (hasCatCol) {
      if (catRaw === "" || catRaw === "-") robloxCatalogAssetId = "omit";
      else if (catRaw.toLowerCase() === "null" || catRaw === "none") robloxCatalogAssetId = null;
      else if (/^\d+$/.test(catRaw)) robloxCatalogAssetId = catRaw;
      else {
        errors.push({ line, message: "robloxCatalogAssetId must be numeric digits, empty, -, or null" });
        continue;
      }
    }

    out.push({
      line,
      robloxAssetId,
      itemName,
      gameSource,
      valueCoins,
      robloxCatalogAssetId,
    });
  }

  if (grid.length - 1 > maxRows) {
    errors.push({ line: 0, message: `Only first ${maxRows} data rows were processed.` });
  }

  return { rows: out, errors };
}
