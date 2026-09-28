declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    MEMBER_CREDENTIALS?: string;
    SESSION_SECRET?: string;
  }
}
