export type Me = {
  id: string;
  robloxId: string;
  username: string;
  displayName: string;
  description: string;
  avatarUrl: string | null;
  profileUrl: string;
  accountCreatedAt: string | null;
  accountAgeDays: number | null;
  isBannedOnRoblox: boolean;
  hasVerifiedBadge: boolean;
  robux: number | null;
  robuxLastSynced: boolean;
  balanceCoins: number;
  lockedCoins?: number;
  authMethod?: string;
  isAdmin: boolean;
  adminTotpEnabled?: boolean;
  siteCreatedAt: string;
  lastLoginIp: string | null;
  suspiciousScore: number;
  linkedBot?: { id: string; robloxUsername: string } | null;
  /** When true, deposit/withdraw trades complete in the DB only; Roblox is not contacted. */
  mockRobloxTrades?: boolean;
};

export type RobloxInvItem = {
  userAssetId: string;
  robloxAssetId: string;
  itemName: string;
  gameSource: string;
  valueCoins: number;
  tradable: boolean;
  onSite: boolean;
  imageUrl: string | null;
};

export type SiteItem = {
  id: string;
  itemId: string;
  robloxAssetId: string;
  itemName: string;
  gameSource: string;
  valueCoins: number;
  status: string;
  depositedAt: string | null;
  imageUrl: string | null;
};
