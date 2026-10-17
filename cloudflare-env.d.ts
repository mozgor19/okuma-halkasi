declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    MEMBER_CREDENTIALS?: string;
    SESSION_SECRET?: string;
    READING_GROUPS_ENABLED?: string;
    /** JSON array of additional D1 binding names. DB is reserved for default. */
    READING_GROUP_DB_BINDINGS?: string;
    SELF_SERVICE_ENABLED?: string;
    SELF_SERVICE_LOCAL?: string;
    /** Unassigned, migrated, empty D1 binding names. No automatic cloud provisioning. */
    SELF_SERVICE_GROUP_BINDINGS?: string;
    AUTH_PUBLIC_ORIGIN?: string;
    APPLICATION_BRAND?: string;
    SUPPORT_EMAIL?: string;
    PRIVACY_POLICY_URL?: string;
    TERMS_URL?: string;
    MAIL_FROM?: string;
    RESEND_API_KEY?: string;
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_SECRET_KEY?: string;
  }
}
