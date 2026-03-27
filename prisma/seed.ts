import "dotenv/config";
import { PrismaClient, BotPoolStatus, JackpotRoundStatus } from "@prisma/client";
import crypto from "node:crypto";
import { createHash } from "node:crypto";
import { LIMITED_ITEMS } from "../frontend/lib/robloxLimiteds";

const prisma = new PrismaClient();

function encryptPlaceholder(cookie: string): string {
  const key = createHash("sha256").update(process.env.ENCRYPTION_KEY ?? "dev".repeat(16)).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(cookie, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

async function seedRobloxLimitedItemValues(): Promise<number> {
  let n = 0;
  for (const item of LIMITED_ITEMS) {
    await prisma.itemValue.upsert({
      where: { robloxAssetId: item.robloxAssetId },
      create: {
        robloxAssetId: item.robloxAssetId,
        itemName: item.itemName,
        gameSource: item.gameSource,
        valueCoins: item.valueCoins,
        robloxCatalogAssetId: item.robloxCatalogAssetId,
      },
      update: {
        itemName: item.itemName,
        gameSource: item.gameSource,
        valueCoins: item.valueCoins,
        robloxCatalogAssetId: item.robloxCatalogAssetId,
      },
    });
    n += 1;
  }
  return n;
}

async function ensureJackpotRound(): Promise<void> {
  const sec = Number(process.env.JACKPOT_ROUND_SECONDS ?? 120);
  const existing = await prisma.jackpotRound.findFirst({
    where: {
      status: { in: [JackpotRoundStatus.waiting, JackpotRoundStatus.active] },
      serverSeed: { not: null },
    },
  });
  if (existing) return;

  const serverSeed = crypto.randomBytes(32).toString("hex");
  const serverSeedHash = sha256Hex(serverSeed);
  const clientSeed = crypto.randomBytes(16).toString("hex");
  const endsAt = new Date(Date.now() + sec * 1000);
  let round = await prisma.jackpotRound.create({
    data: {
      status: JackpotRoundStatus.active,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce: "pending",
      startedAt: new Date(),
      endsAt,
    },
  });
  round = await prisma.jackpotRound.update({
    where: { id: round.id },
    data: { nonce: round.id },
  });
  console.log(`Jackpot: seeded round ${round.id}`);
}

async function main() {
  if ((await prisma.bot.count()) === 0) {
    await prisma.bot.create({
      data: {
        robloxUsername: "DevBot",
        robloxCookieEncrypted: encryptPlaceholder(".ROBLOSECURITY=PLACEHOLDER"),
        status: BotPoolStatus.idle,
      },
    });
  }
  if ((await prisma.bot.count()) < 2) {
    await prisma.bot.create({
      data: {
        robloxUsername: "DevBotTwo",
        robloxCookieEncrypted: encryptPlaceholder(".ROBLOSECURITY=PLACEHOLDER_2"),
        status: BotPoolStatus.idle,
      },
    });
  }

  await prisma.caseDefinition.upsert({
    where: { slug: "starter" },
    create: {
      slug: "starter",
      name: "Starter Case",
      poolJson: [{ name: "Common Item", weight: 80, valueCoins: 10 }],
    },
    update: {},
  });

  await prisma.caseDefinition.upsert({
    where: { slug: "deluxe" },
    create: {
      slug: "deluxe",
      name: "Deluxe Case",
      poolJson: [
        { name: "Rare Pick", weight: 60, valueCoins: 250 },
        { name: "Godly Hit", weight: 5, valueCoins: 50000 },
      ],
    },
    update: {},
  });

  await prisma.caseDefinition.upsert({
    where: { slug: "chroma_pack" },
    create: {
      slug: "chroma_pack",
      name: "Chroma Pack",
      poolJson: [
        { name: "Chroma Roll", weight: 20, valueCoins: 200000 },
        { name: "Standard", weight: 80, valueCoins: 5000 },
      ],
    },
    update: {},
  });

  await prisma.siteConfig.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      data: {
        maintenanceMode: false,
        registrationsOpen: true,
        maxConcurrentTrades: 10,
      },
    },
    update: {},
  });

  const limitedRows = await seedRobloxLimitedItemValues();
  await ensureJackpotRound();

  console.log(`Seed complete. Roblox Limited item_values: ${limitedRows}, bots: ${await prisma.bot.count()}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
