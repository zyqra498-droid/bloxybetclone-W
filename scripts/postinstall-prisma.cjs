/**
 * Runs `prisma generate` after npm install.
 * - Skips on Vercel frontend-only builds
 * - Handles Windows EPERM lock issue
 */

const { execSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const schemaPath = path.join(root, "prisma", "schema.prisma");

// Detect if we're in a Vercel frontend build
const isVercel = !!process.env.VERCEL;
const isFrontendBuild =
  process.env.PWD && process.env.PWD.includes("frontend");

if (isVercel && isFrontendBuild) {
  console.log(
    "[postinstall] Skipping Prisma generate (Vercel frontend build detected)."
  );
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
    console.error(
      "  1. Stop ALL dev servers (npm run dev) and close other terminals."
    );
    console.error("  2. Run: npm run db:generate\n");
    process.exit(0);
  }

  console.error("[postinstall] Prisma generate failed:");
  console.error(out);

  process.exit(e.status ?? 1);
}
