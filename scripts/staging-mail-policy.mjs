import { closeSync, constants, fstatSync, openSync, readFileSync } from "node:fs";
import { OAuth2Client } from "google-auth-library";
import { gmailCredentials } from "../lib/gmail-mail.ts";
import { authorizationPath, gmailOAuth, validatedAuthorization } from "./gmail-oauth.mjs";
import { staging } from "./staging-policy.mjs";

export function readStagingMailSecret(path = authorizationPath) {
  let fd;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const metadata = fstatSync(fd);
    if (!metadata.isFile() || metadata.size > 65_536 || (metadata.mode & 0o777) !== 0o600) throw new Error();
    const data = JSON.parse(readFileSync(fd, "utf8"));
    const value = { ...data, origin: staging.origin, expiresAt: new Date(Date.parse(data.authorizedAt) + 7 * 86_400_000 - 60_000).toISOString() };
    const credentials = gmailCredentials(JSON.stringify(value), { origin: staging.origin, sender: gmailOAuth.sender, staging: true });
    if (!credentials) throw new Error();
    return credentials;
  } catch { throw new Error("Staging Gmail authorization missing, expired or unsafe; credential details withheld"); }
  finally { if (fd !== undefined) closeSync(fd); }
}

export async function verifyStagingMailSecret(credentials) {
  try {
    const client = new OAuth2Client({ clientId: credentials.clientId, clientSecret: credentials.clientSecret, transporterOptions: { timeout: 15_000, retry: false } });
    client.setCredentials({ refresh_token: credentials.refreshToken });
    const access = await client.getAccessToken();
    if (!access.token) throw new Error();
    validatedAuthorization({ clientId: credentials.clientId, clientSecret: credentials.clientSecret },
      { refresh_token: credentials.refreshToken, access_token: access.token }, await client.getTokenInfo(access.token));
  } catch { throw new Error("Google OAuth validation failed; no secret was uploaded and no mail was sent"); }
}

export function assertClosedStagingMailTarget(bindings) {
  for (const [name, text] of Object.entries({ AUTH_PUBLIC_ORIGIN: staging.origin, STAGING_ENVIRONMENT: "true", SELF_SERVICE_ENABLED: "false", SELF_SERVICE_LOCAL: "false" })) {
    if (!bindings.some((binding) => binding.name === name && binding.type === "plain_text" && binding.text === text)) throw new Error("Staging mail target is not the expected closed test environment");
  }
}
