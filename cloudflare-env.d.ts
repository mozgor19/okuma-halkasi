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
    /** firebase-local is emulator-only; firebase uses the separately guarded production provider. */
    AUTH_PROVIDER?: string;
    FIREBASE_LOCAL_EMULATOR_ORIGIN?: string;
    FIREBASE_PROJECT_ID?: string;
    FIREBASE_API_KEY?: string;
    APPLICATION_BRAND?: string;
    FACE_RECOGNITION_ENABLED?: string;
    /** 600000 is a candidate only after remote runtime and rollback acceptance. */
    PASSWORD_HASH_ITERATIONS?: string;
    STAGING_ENVIRONMENT?: string;
    /** Server-only JSON allowlist. Staging self service fails closed without it. */
    SELF_SERVICE_TEST_EMAILS?: string;
    SUPPORT_EMAIL?: string;
    PRIVACY_POLICY_URL?: string;
    TERMS_URL?: string;
    MAIL_FROM?: string;
    RESEND_API_KEY?: string;
    ACCOUNT_MAIL_PROVIDER?: string;
    /** Server-only JSON OAuth credential, never a build variable. */
    GMAIL_CREDENTIALS?: string;
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_SECRET_KEY?: string;
    /** Separate 256-bit operator credential; never a member/group role. */
    ERASURE_OPERATOR_SECRET?: string;
    /** Barrier for new HTTP requests; drain existing writers before erasure. */
    MAINTENANCE_MODE?: string;
  }
}
