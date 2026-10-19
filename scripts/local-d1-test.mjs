import { spawnSync } from "node:child_process";

// Independent local workerd processes can contend while opening SQLite metadata.
// Retry only reads: a failed mutation may already have committed.
export function localTestSql({ config, persistTo, command }, run = spawnSync, wait = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)) {
  const args = ["node_modules/wrangler/bin/wrangler.js", "d1", "execute", "DB", "--local", "--config", config, "--persist-to", persistTo, "--command", command, "--json"];
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = run(process.execPath, args, {
      encoding: "utf8", timeout: 30_000,
      env: { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false", CLOUDFLARE_CF_FETCH_ENABLED: "false" },
    });
    if (!result.error && result.status === 0) {
      const data = JSON.parse(result.stdout);
      if (!Array.isArray(data) || data.some((item) => item.success !== true)) throw new Error("Local D1 test SQL was not successful; output withheld");
      return data.flatMap((item) => item.results || []);
    }
    if (!/^\s*SELECT\b/i.test(command) || /;\s*\S/.test(command) || attempt === 2
      || !/SQLITE_BUSY|database is locked/.test(`${result.stderr || ""}\n${result.stdout || ""}`)) throw new Error("Local D1 test SQL failed; output withheld");
    wait(500 * (attempt + 1));
  }
}
