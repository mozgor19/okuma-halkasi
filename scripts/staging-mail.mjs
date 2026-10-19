import { chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readStagingMailSecret, verifyStagingMailSecret } from "./staging-mail-policy.mjs";
import { gmailOAuth } from "./gmail-oauth.mjs";
import { sendGmailMail } from "../lib/gmail-mail.ts";
import { staging, stagingDirectory } from "./staging-policy.mjs";

try {
  if (process.argv.length !== 3 || process.argv[2] !== "--confirm=koru-staging") throw new Error();
  const credentials = readStagingMailSecret();
  await verifyStagingMailSecret(credentials);
  const receiptPath = join(stagingDirectory, "gmail-smoke.json");
  if (existsSync(receiptPath)) {
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    console.log(JSON.stringify({ status: receipt.status, repeated: false, message: "A smoke send was already attempted. No additional email sent; review the existing receipt." }));
  } else {
    mkdirSync(stagingDirectory, { recursive: true, mode: 0o700 });
    if (realpathSync(stagingDirectory) !== resolve(stagingDirectory)) throw new Error();
    chmodSync(stagingDirectory, 0o700);
    const receipt = { environment: staging.worker, transport: "node-shared-adapter", status: "attempted", attemptedAt: new Date().toISOString(), inboxConfirmed: false };
    // Persist before sending: a crash or ambiguous provider response must not repeat a send.
    writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), { mode: 0o600, flag: "wx" });
    await sendGmailMail(credentials, {
      recipient: gmailOAuth.sender, replyTo: gmailOAuth.sender,
      subject: "Koru: e-posta ba\u011flant\u0131 testi",
      text: "Koru test ortaminda Gmail gonderim baglantisi kontrol edildi.\n\nBu bir deneme e-postasidir. Sifre sifirlama veya hesap dogrulama baglantisi icermez.\nCanli site ve kullanici verileri degistirilmedi.\n\nBu e-postayi Gelen Kutusu veya Spam klasorunde gordugunu bildirmen yeterli.",
    });
    receipt.status = "accepted";
    writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ ...receipt, recipient: gmailOAuth.sender, subject: "Koru: e-posta baglanti testi", note: "Google accepted the send. Inbox delivery still requires the operator's confirmation. No Worker HTTP flow was exercised." }));
  }
} catch { console.error("Staging Gmail check failed; sensitive details withheld. Do not repeat a send without reviewing the private receipt."); process.exitCode = 1; }
