import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { groupsConfigPath, groupsStatePath, testRunId } from "./test-environment.mjs";

export function readDevelopmentMail(recipient) {
  if (!testRunId || !existsSync(groupsConfigPath) || !existsSync(groupsStatePath)) throw new Error("Only an isolated local test mailbox may be read.");
  if (recipient && !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~@-]{3,254}$/.test(recipient)) throw new Error("Invalid local recipient filter.");
  const result = spawnSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "d1", "execute", "DB", "--local", "--config", groupsConfigPath,
    "--persist-to", groupsStatePath, "--json", "--command", `SELECT recipient, subject, body FROM development_mail WHERE expires_at > ${Date.now()}${recipient ? " AND recipient = '" + recipient.replaceAll("'", "''") + "'" : ""} ORDER BY rowid DESC LIMIT 10`],
  { encoding: "utf8", env: { ...process.env, WRANGLER_SEND_METRICS: "false", CLOUDFLARE_CF_FETCH_ENABLED: "false" }, maxBuffer: 1024 * 1024 });
  if (result.status !== 0) throw new Error("Local mailbox could not be read.");
  return JSON.parse(result.stdout).flatMap((item) => item.results || []);
}

if (process.argv[1]?.endsWith("/development-mail.mjs")) {
  console.log("LOCAL TEST EMAIL ONLY. These short-lived links must not be committed or shared.");
  for (const mail of readDevelopmentMail(process.argv[2])) console.log(`\nTo: ${mail.recipient}\n${mail.subject}\n${mail.body}`);
}
