# Catalog & trade bot — beginner tutorial

This project keeps a **price catalog** in Postgres (`item_values`). Each row describes one item users can price, deposit, or withdraw. **Real** Roblox trades also need a **numeric catalog asset id** for each limited and a **trade bot** account that owns those items.

---

## Part A — Understand the catalog

### What each field means

| Field | What it is |
|--------|------------|
| `robloxAssetId` | Stable id in **your** database. Seeds use slugs like `limited-sparkle-time-fedora`. It does **not** have to match Roblox’s number. |
| `itemName` | Display name (should match the Roblox limited name you price). |
| `gameSource` | e.g. `ROBLOX_LIMITED` |
| `valueCoins` | Site coin value used for games and wallet. |
| `robloxCatalogAssetId` | The **numeric** Roblox **catalog** id for that **limited**. Required for **real** withdrawals when `robloxAssetId` is not already a number. Find it on the item’s Roblox catalog URL or trusted item databases — always double-check. |

### Ways to fill the catalog

1. **Seed** (already in the repo): run from the project root:  
   `npm run db:seed`  
   That creates Roblox Limited rows with `limited-...` keys, values, and **seed** catalog ids — verify each in admin if needed.

2. **Admin → Item values (grid)**  
   Open `/admin`, tab **Item values**. Search, edit cells, **Save row**.

3. **Roblox catalog lookup** (same tab, below the quick form)  
   Type a keyword (e.g. `"Sparkle Time Fedora"`, `"Domino Crown"`). Results come from Roblox’s **public** catalog API. Always open **Roblox page**, confirm **Tradable: Yes**, and that it’s the right **limited**. Then **Copy id** or **Use in quick form**, paste into a grid row if needed, **Save**.

4. **CSV import** (same tab)  
   - Download **Sample CSV**.  
   - Fill columns in Excel / Google Sheets, export as CSV (UTF‑8).  
   - **Import CSV**.

### CSV columns (header row required)

Required:

- `robloxAssetId`
- `itemName`
- `valueCoins`

Optional:

- `gameSource` — defaults to `ROBLOX_LIMITED` if omitted (see backend CSV parser).
- `robloxCatalogAssetId` — numeric string.
  - Leave **empty** or `-` to **leave the existing** catalog id unchanged on update (or `null` on new rows).
  - Use `null` (word) in the cell to **clear** the catalog id.

**Snake_case headers** also work (`roblox_asset_id`, `value_coins`, etc.).

Max ~2500 rows per file (additional rows get a warning and are skipped).

---

## Part B — Trade bot (real deposits & withdrawals)

### What the bot does

- **Deposits:** Users send a Roblox trade **to** the bot. The server accepts the trade and waits until Roblox marks it **Completed**, then credits the site inventory.
- **Withdrawals:** The server sends a trade **from** the bot **to** the user. The user accepts on Roblox. The bot must **own** that limited (same **numeric** asset id as `robloxCatalogAssetId` / stored user item).

### Prerequisites checklist

1. **PostgreSQL** running and `DATABASE_URL` correct.  
2. **Redis** running (`REDIS_URL`) — the trade queue uses Bull.  
3. **Backend** running (`npm run dev` from the repo or start the API) — it runs the **trade worker** in the same process.  
4. **`.env`** (never commit real secrets):

   ```env
   MOCK_ROBLOX_TRADES=false
   TRADE_BOT_ROBLOX_USERNAME=YourBotAccountUsername
   TRADE_BOT_ROBLOX_USER_ID=1234567890
   TRADE_BOT_COOKIE=.ROBLOSECURITY=_|WARNING:-DO-NOT-SHARE-THIS...
   ```

   - Username + cookie are **required** together for `syncTradeBotFromEnv` on startup.  
   - User id is optional; the server can fill it from Roblox if missing.

5. **Bot account on Roblox**

   - Turn **on** trading in Roblox privacy settings.  
   - Complete any trade/email holds Roblox requires.  
   - **Inventory:** the bot must physically own copies of items you allow users to withdraw (matching catalog asset ids).

6. **Catalog ids** — every withdrawable market/catalog row needs a correct `robloxCatalogAssetId` (or numeric `robloxAssetId`) so the server can pick the right bot collectible.

### Order of operations (first-time setup)

1. Run `npm run db:push` (or your migrate step) so the DB schema is current.  
2. Run `npm run db:seed` so base `item_values` exist.  
3. Verify **`robloxCatalogAssetId`** for each item (grid or CSV) against Roblox (**Tradable: Yes**).  
4. Put **limiteds** on the **bot** account in Roblox (trade them to the bot or use a storage account you control).  
5. Set **`MOCK_ROBLOX_TRADES=false`** and bot env vars; **restart** the API.  

---

## Quick troubleshooting

- **`EPERM` on `prisma generate` (Windows):** Stop all Node processes using this folder, then `npm run db:generate`.  
- **Deposit shows 0 ◈:** Item not in `item_values` or name mismatch — add row in admin or fix `itemName`.  
- **Withdraw fails:** Bot doesn’t own that asset id, or catalog id wrong, or cookie expired.
