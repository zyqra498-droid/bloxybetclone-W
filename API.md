# API overview

Base URL: `APP_URL` (e.g. `http://localhost:4000`). The Next.js app can proxy `/api/*` to this origin.

## Auth (`/api/auth`)

| Method | Path | Notes |
|--------|------|--------|
| POST | `/bio/start` | Returns `challengeId` + one-time code; CSRF required. |
| POST | `/bio/verify` | Body: `challengeId`, `username` — checks Roblox profile bio; sets HttpOnly cookies. |
| POST | `/logout` | CSRF required. |
| POST | `/refresh` | Refresh token rotation; CSRF required. |
| GET | `/me` | Current user (JWT cookie). |

## Inventory (`/api/inventory`)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/fetch` | Pull Roblox collectibles + merge `item_values`. Auth. |
| GET | `/deposited` | Site inventory. Auth. |
| GET | `/trades` | Deposit/withdraw sessions. Auth. |
| POST | `/deposit` | Start deposit trade; CSRF. |
| POST | `/withdraw` | Start withdrawal trade; CSRF. |

## Wallet (`/api/wallet`)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/ledger` | Balance change log. Auth. |
| GET | `/summary` | balanceCoins, lockedCoins, available. Auth. |
| GET | `/deposits` | Roblox→site deposit sessions (from `Trade`). Auth. |
| GET | `/withdrawals` | Site→Roblox withdrawals. Auth. |

## Users (`/api/users`)

| Method | Path | Notes |
|--------|------|--------|
| POST | `/me/linked-bot` | Body `{ "botId": "<id>" \| null }` — optional preferred bot for trades. CSRF. |

## Games

### Coinflip `/api/games/coinflip`

| Method | Path |
|--------|------|
| POST | `/create` | Item stake. |
| POST | `/create-coins` | Site ◈ stake. |
| POST | `/join/:roomId` | Item join. |
| POST | `/join-coins/:roomId` | Coin join (same stake). |
| GET | `/rooms` |
| GET | `/history` |

### Jackpot `/api/games/jackpot`

| Method | Path |
|--------|------|
| POST | `/deposit` |
| GET | `/current-round` |
| GET | `/history` |

### Case battles (Phase 2) `/api/games/case-battles`

| Method | Path |
|--------|------|
| GET | `/cases` |
| POST | `/create` |
| POST | `/join/:battleId` |

## Bots `/api/bots` (admin + TOTP if enabled)

| Method | Path |
|--------|------|
| GET | `/status` |
| POST | `/add-bot` |
| POST | `/remove-bot/:botId` |

## Admin `/api/admin`

| Method | Path |
|--------|------|
| GET | `/users` |
| GET | `/trades` |
| POST | `/set-item-value` |
| POST | `/ban-user` |
| POST | `/adjust-balance` | Admin coin grant/deduct (ledger). |
| GET | `/audit-logs` | Server audit trail (`?take=`). |
| GET | `/revenue-stats` |
| POST | `/configure-house-edge` |

## Verify `/api/verify`

| Method | Path |
|--------|------|
| POST | `/coinflip` |
| POST | `/jackpot` |

## Webhooks `/api/webhooks`

| Method | Path |
|--------|------|
| POST | `/trade` | Lua / worker callbacks (HMAC). |

## Socket.IO

Connect to the same host as the API (`NEXT_PUBLIC_SOCKET_URL`). Authenticated users join `user:{userId}` for targeted events.

## Environment

See `.env.example` in the repository root.
