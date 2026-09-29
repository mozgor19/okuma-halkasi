import { env } from "cloudflare:workers";

export function database() {
  if (!env.DB) throw new Error("Veritabanı bağlı değil.");
  return env.DB;
}
