declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    MEMBER_CREDENTIALS?: string;
    SESSION_SECRET?: string;
    READING_GROUPS_ENABLED?: string;
    /** JSON array of additional D1 binding names. DB is reserved for default. */
    READING_GROUP_DB_BINDINGS?: string;
  }
}
