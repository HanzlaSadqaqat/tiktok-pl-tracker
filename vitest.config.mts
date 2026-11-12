import { defineConfig } from "vitest/config";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The database tests run a throwaway MongoDB through mongodb-memory-server (never Atlas).
 * If MongoDB Server is installed locally, use its mongod instead of downloading one
 * (the download is several hundred MB). Set MONGOMS_SYSTEM_BINARY yourself to override.
 */
function localMongod(): string | undefined {
  if (process.env.MONGOMS_SYSTEM_BINARY) return process.env.MONGOMS_SYSTEM_BINARY;
  const winRoot = "C:/Program Files/MongoDB/Server";
  if (existsSync(winRoot)) {
    const versions = readdirSync(winRoot).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const v of versions) if (existsSync(`${winRoot}/${v}/bin/mongod.exe`)) return `${winRoot}/${v}/bin/mongod.exe`;
  }
  for (const p of ["/usr/bin/mongod", "/usr/local/bin/mongod", "/opt/homebrew/bin/mongod"]) if (existsSync(p)) return p;
  return undefined;
}
const mongod = localMongod();
if (mongod) process.env.MONGOMS_SYSTEM_BINARY = mongod;

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "server-only" throws outside a React server build; the database tests import server modules directly.
      "server-only": fileURLToPath(new URL("./src/test/empty.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // The database tests start an in-memory MongoDB, which takes a few seconds.
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
