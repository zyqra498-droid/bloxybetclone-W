/**
 * Runs `prisma generate` after npm install.
 * Skips on Vercel frontend-only builds and handles Windows file lock issues.
 */

const { execSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const schemaPath = path.join(root, "prisma", "schema.prisma");

const isVercel = process.env.VERCEL === "1" || process.env.VERCEL === "true";

// Vercel monorepo/root installs can still happen even when Root Directory is `frontend`.
// If we're on Vercel and the frontend workspace exists, skip Prisma generation.
const frontendDir = path.join(root, "frontend");

if (isVercel) {
  console.log("[postinstall] Vercel environment detected. Skipping Prisma generate for frontend deploy.");
  process.exit(0);
}

const cmd = `npx prisma generate --schema="${schemaPath}"`;

try {
  execSync(cmd, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    stdio: ["ignore", "inherit", "pipe"],
  });

  console.log("[postinstall] Prisma Client generated successfully.");
  process.exit(0);
} catch (e) {
  const out =
    String(e.stderr || "") +
    String(e.stdout || "") +
    String(e.message || "");

  if (/EPERM|operation not permitted|EBUSY/i.test(out)) {
    console.error(
      "\n[postinstall] Prisma Client could not be generated: engine file is locked (common on Windows)."
    );
    console.error("  1. Stop all dev servers and other Node terminals.");
    console.error("  2. Run: npm run db:generate\n");
    process.exit(0);
  }

  console.error("[postinstall] Prisma generate failed:");
  console.error(out);
  process.exit(e.status ?? 1);
}
