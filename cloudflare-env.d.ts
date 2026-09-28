declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    GROUP_PASSWORD?: string;
    SESSION_SECRET?: string;
  }
}
