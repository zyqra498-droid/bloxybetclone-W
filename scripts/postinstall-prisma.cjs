/**
 * Runs `prisma generate` after npm install. On Windows, the query engine DLL can be
 * locked by a running API/dev process, causing EPERM on rename — allow install to finish
 * and print recovery steps.
 */
const { execSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const cmd = "npx prisma generate --schema=./prisma/schema.prisma";

try {
  execSync(cmd, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    stdio: ["ignore", "inherit", "pipe"],
  });
  process.exit(0);
} catch (e) {
  const out = String(e.stderr || "") + String(e.stdout || "") + String(e.message || "");
  if (/EPERM|operation not permitted|EBUSY/i.test(out)) {
    console.error("\n[postinstall] Prisma Client could not be generated: engine file is locked (common on Windows).");
    console.error("  1. Stop ALL dev servers (npm run dev) and close other terminals running Node for this folder.");
    console.error("  2. Run: npm run db:generate\n");
    process.exit(0);
  }
  process.exit(e.status ?? 1);
}
