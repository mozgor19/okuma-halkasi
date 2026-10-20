import { sql } from "drizzle-orm";
import { blob, check, foreignKey, integer, sqliteTable, text, primaryKey, unique, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  role: text("role").notNull().default("member"),
  color: text("color").notNull().default("#5e8b88"),
  avatarMediaKey: text("avatar_media_key"),
  faceReferenceMediaKey: text("face_reference_media_key"),
  faceRecognitionConsent: integer("face_recognition_consent", { mode: "boolean" }).notNull().default(false),
  isGuest: integer("is_guest", { mode: "boolean" }).notNull().default(false),
  guestMeetingId: integer("guest_meeting_id"),
});
export const memberAccounts = sqliteTable("member_accounts", {
  memberId: integer("member_id").primaryKey().references(() => members.id),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  passwordIterations: integer("password_iterations").notNull(),
  sessionVersion: integer("session_version").notNull().default(1),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: text("locked_until"),
  passwordChangedAt: text("password_changed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const readingGroups = sqliteTable("reading_groups", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  bindingName: text("binding_name").notNull().unique(),
}, (table) => [
  check("reading_groups_default_binding", sql`(${table.id} = 'default' AND ${table.bindingName} = 'DB') OR (${table.id} <> 'default' AND ${table.bindingName} <> 'DB')`),
]);

export const readingGroupMemberships = sqliteTable("reading_group_memberships", {
  accountMemberId: integer("account_member_id").notNull().references(() => members.id),
  groupId: text("group_id").notNull().references(() => readingGroups.id),
  memberId: integer("member_id").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  scheme: text("scheme", { enum: ["editorial", "catalogue", "notebook", "minimal"] }).notNull().default("notebook"),
  colorMode: text("color_mode", { enum: ["light", "dark", "system"] }).notNull().default("system"),
}, (table) => [
  primaryKey({ columns: [table.accountMemberId, table.groupId] }),
  unique().on(table.groupId, table.memberId),
  check("reading_group_memberships_member_id", sql`${table.memberId} > 0`),
  check("reading_group_memberships_is_active", sql`${table.isActive} IN (0, 1)`),
  check("reading_group_memberships_scheme", sql`${table.scheme} IN ('editorial', 'catalogue', 'notebook', 'minimal')`),
  check("reading_group_memberships_color_mode", sql`${table.colorMode} IN ('light', 'dark', 'system')`),
]);

export const accountProfiles = sqliteTable("account_profiles", {
  memberId: integer("member_id").primaryKey().notNull().references(() => memberAccounts.memberId),
  email: text("email").notNull().unique(),
  verifiedAt: integer("verified_at").notNull(),
  policyVersion: text("policy_version").notNull(),
});
export const firebaseEnvironment = sqliteTable("firebase_environment", {
  singleton: integer("singleton").primaryKey().notNull(),
  projectId: text("project_id").notNull(),
}, (table) => [
  check("firebase_environment_singleton", sql`${table.singleton} = 1`),
  check("firebase_environment_project", sql`${table.projectId} = 'koru-951bf'`),
]);
export const firebaseRegistrations = sqliteTable("firebase_registrations", {
  id: text("id").primaryKey().notNull(),
  projectId: text("project_id").notNull(),
  firebaseUid: text("firebase_uid"),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  expiresAt: integer("expires_at").notNull(),
  memberId: integer("member_id").references(() => members.id),
  claimMemberId: integer("claim_member_id").references(() => memberAccounts.memberId),
  claimVersion: integer("claim_version"),
  consumedAt: integer("consumed_at"),
}, (table) => [
  unique().on(table.projectId, table.firebaseUid),
  check("firebase_registrations_claim", sql`(${table.claimMemberId} IS NULL AND ${table.claimVersion} IS NULL) OR
    (${table.claimMemberId} IS NOT NULL AND ${table.claimVersion} IS NOT NULL AND ${table.claimMemberId} > 0 AND ${table.claimVersion} >= 0)`),
]);
export const firebaseLinks = sqliteTable("firebase_links", {
  memberId: integer("member_id").primaryKey().notNull().references(() => memberAccounts.memberId),
  projectId: text("project_id").notNull(),
  firebaseUid: text("firebase_uid").notNull(),
  mutationPending: integer("mutation_pending", { mode: "boolean" }).notNull().default(false),
  mutationStartedAt: integer("mutation_started_at"),
  mutationValidSince: integer("mutation_valid_since"),
  mutationKind: text("mutation_kind", { enum: ["password", "reset", "erasure"] }),
}, (table) => [
  unique().on(table.projectId, table.firebaseUid),
  check("firebase_links_mutation_pending", sql`${table.mutationPending} IN (0, 1)`),
  check("firebase_links_mutation_kind", sql`${table.mutationKind} IN ('password', 'reset', 'erasure')`),
]);
export const firebaseSessions = sqliteTable("firebase_sessions", {
  tokenHash: text("token_hash").primaryKey().notNull(),
  memberId: integer("member_id").notNull().references(() => memberAccounts.memberId),
  sessionVersion: integer("session_version").notNull(),
  projectId: text("project_id").notNull(),
  firebaseUid: text("firebase_uid").notNull(),
  authTime: integer("auth_time").notNull(),
  sealedCredentials: text("sealed_credentials").notNull(),
  expiresAt: integer("expires_at").notNull(),
  revokedAt: integer("revoked_at"),
}, (table) => [index("firebase_sessions_member").on(table.memberId)]);
export const accountExperience = sqliteTable("account_experience", {
  memberId: integer("member_id").primaryKey().notNull().references(() => memberAccounts.memberId),
  tourVersion: integer("tour_version").notNull(),
  tourState: text("tour_state", { enum: ["completed", "dismissed"] }).notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [check("account_experience_version", sql`${table.tourVersion} > 0`), check("account_experience_state", sql`${table.tourState} IN ('completed', 'dismissed')`)]);
export const accountDeletionRequests = sqliteTable("account_deletion_requests", {
  id: text("id").primaryKey().notNull(),
  memberId: integer("member_id").notNull().unique().references(() => memberAccounts.memberId),
  status: text("status", { enum: ["requested", "processing", "cancelled", "completed"] }).notNull().default("requested"),
  requestedAt: integer("requested_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [index("account_deletion_requests_status").on(table.status, table.requestedAt), check("account_deletion_requests_state", sql`${table.status} IN ('requested', 'processing', 'cancelled', 'completed')`)]);
export const accountErasureJobs = sqliteTable("account_erasure_jobs", {
  requestId: text("request_id").primaryKey().notNull(),
  accountMemberId: integer("account_member_id").notNull().unique(),
  planJson: text("plan_json").notNull(),
  planDigest: text("plan_digest").notNull(),
  completedBindings: text("completed_bindings").notNull().default("[]"),
  leaseToken: text("lease_token"),
  frozenAt: integer("frozen_at"),
  completedAt: integer("completed_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  check("account_erasure_member_id", sql`${table.accountMemberId} > 0`),
  check("account_erasure_plan_json", sql`json_valid(${table.planJson})`),
  check("account_erasure_plan_digest", sql`length(${table.planDigest}) = 64`),
  check("account_erasure_completed_bindings", sql`json_valid(${table.completedBindings})`),
  uniqueIndex("account_erasure_single_runner").on(sql`(1)`).where(sql`${table.leaseToken} IS NOT NULL`),
  uniqueIndex("account_erasure_single_pending").on(sql`(1)`).where(sql`${table.completedAt} IS NULL`),
]);
export const accountErasureProviderCheckpoints = sqliteTable("account_erasure_provider_checkpoints", {
  requestId: text("request_id").notNull().references(() => accountErasureJobs.requestId),
  projectId: text("project_id").notNull(),
  uidDigest: text("uid_digest").notNull(),
  deletedAt: integer("deleted_at"),
}, (table) => [
  primaryKey({ columns: [table.requestId, table.projectId, table.uidDigest] }),
  check("account_erasure_provider_project", sql`${table.projectId} = 'koru-951bf'`),
  check("account_erasure_provider_digest", sql`length(${table.uidDigest}) = 64`),
]);
export const pendingRegistrations = sqliteTable("pending_registrations", {
  tokenHash: text("token_hash").primaryKey().notNull(), email: text("email").notNull(),
  username: text("username").notNull(), name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(), passwordSalt: text("password_salt").notNull(),
  passwordIterations: integer("password_iterations").notNull(), expiresAt: integer("expires_at").notNull(),
  consumedAt: integer("consumed_at"), memberId: integer("member_id").references(() => members.id),
}, (table) => [index("pending_registrations_expiry").on(table.expiresAt)]);
export const accountRecoveryTokens = sqliteTable("account_recovery_tokens", {
  tokenHash: text("token_hash").primaryKey().notNull(),
  memberId: integer("member_id").notNull().references(() => memberAccounts.memberId),
  sessionVersion: integer("session_version").notNull(), expiresAt: integer("expires_at").notNull(), consumedAt: integer("consumed_at"),
});
export const accountEmailVerifications = sqliteTable("account_email_verifications", {
  tokenHash: text("token_hash").primaryKey().notNull(),
  memberId: integer("member_id").notNull().references(() => memberAccounts.memberId),
  email: text("email").notNull(), sessionVersion: integer("session_version").notNull(),
  expiresAt: integer("expires_at").notNull(), consumedAt: integer("consumed_at"),
});
export const securityRateLimits = sqliteTable("security_rate_limits", {
  key: text("key").primaryKey().notNull(), count: integer("count").notNull(), expiresAt: integer("expires_at").notNull(),
});
export const developmentMail = sqliteTable("development_mail", {
  id: text("id").primaryKey().notNull(), recipient: text("recipient").notNull(), subject: text("subject").notNull(),
  body: text("body").notNull(), expiresAt: integer("expires_at").notNull(),
});
export const groupProvisioning = sqliteTable("group_provisioning", {
  groupId: text("group_id").primaryKey().notNull().references(() => readingGroups.id),
  ownerId: integer("owner_id").notNull().references(() => members.id), requestKey: text("request_key").notNull(),
  state: text("state", { enum: ["pending", "ready"] }).notNull().default("pending"), createdAt: integer("created_at").notNull(),
}, (table) => [unique().on(table.ownerId, table.requestKey), check("group_provisioning_state", sql`${table.state} IN ('pending', 'ready')`)]);
export const groupInvitations = sqliteTable("group_invitations", {
  id: text("id").primaryKey().notNull(), groupId: text("group_id").notNull().references(() => readingGroups.id),
  tokenHash: text("token_hash").notNull().unique(), createdBy: integer("created_by").notNull().references(() => members.id),
  createdAt: integer("created_at").notNull(), expiresAt: integer("expires_at").notNull(),
  maxUses: integer("max_uses").notNull(), revokedAt: integer("revoked_at"),
}, (table) => [check("group_invitations_max_uses", sql`${table.maxUses} BETWEEN 1 AND 100`)]);
export const groupInvitationRedemptions = sqliteTable("group_invitation_redemptions", {
  accountMemberId: integer("account_member_id").notNull().references(() => members.id),
  groupId: text("group_id").notNull().references(() => readingGroups.id),
  invitationId: text("invitation_id").notNull().references(() => groupInvitations.id),
  state: text("state", { enum: ["pending", "ready"] }).notNull().default("pending"), createdAt: integer("created_at").notNull(),
}, (table) => [primaryKey({ columns: [table.accountMemberId, table.groupId] }), index("group_invitation_redemptions_invite").on(table.invitationId), check("group_invitation_redemptions_state", sql`${table.state} IN ('pending', 'ready')`)]);
export const groupAccountLinks = sqliteTable("group_account_links", {
  accountMemberId: integer("account_member_id").primaryKey().notNull(),
  memberId: integer("member_id").notNull().unique().references(() => members.id),
});
export const groupDatabaseOwnership = sqliteTable("group_database_ownership", {
  singleton: integer("singleton").primaryKey().notNull(), groupId: text("group_id").notNull().unique(),
}, (table) => [check("group_database_ownership_singleton", sql`${table.singleton} = 1`)]);

export const books = sqliteTable("books", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  author: text("author").notNull(),
  publisher: text("publisher"),
  pages: integer("pages"),
  isbn: text("isbn"),
  coverUrl: text("cover_url"),
  sourceUrl: text("source_url"),
});
export const meetings = sqliteTable("meetings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookId: integer("book_id").notNull().references(() => books.id),
  date: text("date").notNull(),
  location: text("location").notNull(),
  mapUrl: text("map_url"),
  note: text("note"),
  readingScope: text("reading_scope"),
  bookStatus: text("book_status").notNull().default("completed"),
  createdBy: integer("created_by").notNull().references(() => members.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text("deleted_at"),
});
export const attendance = sqliteTable("attendance", {
  meetingId: integer("meeting_id").notNull().references(() => meetings.id),
  memberId: integer("member_id").notNull().references(() => members.id),
  readingStatus: text("reading_status").notNull().default("unselected"),
  currentPage: integer("current_page"),
}, (table) => [primaryKey({ columns: [table.meetingId, table.memberId] })]);
export const meetingRsvps = sqliteTable("meeting_rsvps", {
  meetingId: integer("meeting_id").notNull().references(() => meetings.id),
  memberId: integer("member_id").notNull().references(() => members.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.meetingId, table.memberId] })]);

export const reviews = sqliteTable("reviews", {
  meetingId: integer("meeting_id").notNull().references(() => meetings.id),
  memberId: integer("member_id").notNull().references(() => members.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.meetingId, table.memberId] })]);
export const media = sqliteTable("media", {
  mediaKey: text("media_key").primaryKey(),
  contentType: text("content_type").notNull(),
  data: blob("data", { mode: "buffer" }).notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const photos = sqliteTable("photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  meetingId: integer("meeting_id").notNull().references(() => meetings.id),
  mediaKey: text("media_key").notNull(),
  uploadedBy: integer("uploaded_by").notNull().references(() => members.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const roadmap = sqliteTable("roadmap", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookId: integer("book_id").notNull().references(() => books.id),
  plannedDate: text("planned_date"),
  note: text("note"),
  createdBy: integer("created_by").notNull().references(() => members.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text("deleted_at"),
});

export const favoriteBooks = sqliteTable("favorite_books", {
  memberId: integer("member_id").notNull().references(() => members.id),
  bookId: integer("book_id").notNull().references(() => books.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.memberId, table.bookId] })]);

export const bookVotes = sqliteTable("book_votes", {
  memberId: integer("member_id").primaryKey().references(() => members.id),
  roadmapId: integer("roadmap_id").notNull().references(() => roadmap.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const clubSettings = sqliteTable("club_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const sharedGroupStorage = sqliteTable("shared_group_storage", {
  groupId: text("group_id").primaryKey().notNull().references(() => readingGroups.id),
}, (t) => [check("shared_group_not_default", sql`${t.groupId} <> 'default'`)]);
const sharedGroupId = () => text("group_id").notNull().references(() => sharedGroupStorage.groupId);
const sharedId = () => integer("id").primaryKey({ autoIncrement: true }).notNull();
const createdAt = () => text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`);
export const sharedMembers = sqliteTable("shared_members", {
  id: sharedId(), groupId: sharedGroupId(), name: text("name").notNull(),
  role: text("role").notNull().default("member"), color: text("color").notNull().default("#5e8b88"),
  avatarMediaKey: text("avatar_media_key"), faceReferenceMediaKey: text("face_reference_media_key"),
  faceRecognitionConsent: integer("face_recognition_consent").notNull().default(0),
  isGuest: integer("is_guest").notNull().default(0), guestMeetingId: integer("guest_meeting_id"),
}, (t) => [unique().on(t.groupId, t.id), check("shared_member_role", sql`${t.role} IN ('member', 'admin', 'super_admin')`),
  check("shared_member_guest", sql`${t.isGuest} IN (0, 1)`), check("shared_member_consent", sql`${t.faceRecognitionConsent} IN (0, 1)`)]);
export const sharedBooks = sqliteTable("shared_books", {
  id: sharedId(), groupId: sharedGroupId(), title: text("title").notNull(), author: text("author").notNull(),
  publisher: text("publisher"), pages: integer("pages"), isbn: text("isbn"), coverUrl: text("cover_url"), sourceUrl: text("source_url"),
}, (t) => [unique().on(t.groupId, t.id)]);
export const sharedMeetings = sqliteTable("shared_meetings", {
  id: sharedId(), groupId: sharedGroupId(), bookId: integer("book_id").notNull(), date: text("date").notNull(),
  location: text("location").notNull(), mapUrl: text("map_url"), note: text("note"), readingScope: text("reading_scope"),
  bookStatus: text("book_status").notNull().default("completed"), createdBy: integer("created_by").notNull(),
  createdAt: createdAt(), deletedAt: text("deleted_at"),
}, (t) => [unique().on(t.groupId, t.id),
  foreignKey({ columns: [t.groupId, t.bookId], foreignColumns: [sharedBooks.groupId, sharedBooks.id] }),
  foreignKey({ columns: [t.groupId, t.createdBy], foreignColumns: [sharedMembers.groupId, sharedMembers.id] }),
  index("shared_meetings_group_date").on(t.groupId, t.deletedAt, t.date)]);
export const sharedAttendance = sqliteTable("shared_attendance", {
  groupId: sharedGroupId(), meetingId: integer("meeting_id").notNull(), memberId: integer("member_id").notNull(),
  readingStatus: text("reading_status").notNull().default("unselected"), currentPage: integer("current_page"),
}, (t) => [primaryKey({ columns: [t.groupId, t.meetingId, t.memberId] }),
  foreignKey({ columns: [t.groupId, t.meetingId], foreignColumns: [sharedMeetings.groupId, sharedMeetings.id] }),
  foreignKey({ columns: [t.groupId, t.memberId], foreignColumns: [sharedMembers.groupId, sharedMembers.id] })]);
export const sharedMeetingRsvps = sqliteTable("shared_meeting_rsvps", {
  groupId: sharedGroupId(), meetingId: integer("meeting_id").notNull(), memberId: integer("member_id").notNull(),
  createdAt: createdAt(), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [primaryKey({ columns: [t.groupId, t.meetingId, t.memberId] }),
  foreignKey({ columns: [t.groupId, t.meetingId], foreignColumns: [sharedMeetings.groupId, sharedMeetings.id] }),
  foreignKey({ columns: [t.groupId, t.memberId], foreignColumns: [sharedMembers.groupId, sharedMembers.id] })]);
export const sharedReviews = sqliteTable("shared_reviews", {
  groupId: sharedGroupId(), meetingId: integer("meeting_id").notNull(), memberId: integer("member_id").notNull(),
  rating: integer("rating").notNull(), comment: text("comment"), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [primaryKey({ columns: [t.groupId, t.meetingId, t.memberId] }),
  foreignKey({ columns: [t.groupId, t.meetingId], foreignColumns: [sharedMeetings.groupId, sharedMeetings.id] }),
  foreignKey({ columns: [t.groupId, t.memberId], foreignColumns: [sharedMembers.groupId, sharedMembers.id] })]);
export const sharedMedia = sqliteTable("shared_media", {
  groupId: sharedGroupId(), mediaKey: text("media_key").notNull(), contentType: text("content_type").notNull(),
  data: blob("data", { mode: "buffer" }).notNull(), createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.groupId, t.mediaKey] })]);
export const sharedPhotos = sqliteTable("shared_photos", {
  id: sharedId(), groupId: sharedGroupId(), meetingId: integer("meeting_id").notNull(), mediaKey: text("media_key").notNull(),
  uploadedBy: integer("uploaded_by").notNull(), createdAt: createdAt(),
}, (t) => [unique().on(t.groupId, t.id),
  foreignKey({ columns: [t.groupId, t.meetingId], foreignColumns: [sharedMeetings.groupId, sharedMeetings.id] }),
  foreignKey({ columns: [t.groupId, t.uploadedBy], foreignColumns: [sharedMembers.groupId, sharedMembers.id] }),
  index("shared_photos_group_member").on(t.groupId, t.uploadedBy)]);
export const sharedRoadmap = sqliteTable("shared_roadmap", {
  id: sharedId(), groupId: sharedGroupId(), bookId: integer("book_id").notNull(), plannedDate: text("planned_date"),
  note: text("note"), createdBy: integer("created_by").notNull(), createdAt: createdAt(), deletedAt: text("deleted_at"),
}, (t) => [unique().on(t.groupId, t.id),
  foreignKey({ columns: [t.groupId, t.bookId], foreignColumns: [sharedBooks.groupId, sharedBooks.id] }),
  foreignKey({ columns: [t.groupId, t.createdBy], foreignColumns: [sharedMembers.groupId, sharedMembers.id] }),
  index("shared_roadmap_group_date").on(t.groupId, t.deletedAt, t.plannedDate)]);
export const sharedFavoriteBooks = sqliteTable("shared_favorite_books", {
  groupId: sharedGroupId(), memberId: integer("member_id").notNull(), bookId: integer("book_id").notNull(), createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.groupId, t.memberId, t.bookId] }),
  foreignKey({ columns: [t.groupId, t.memberId], foreignColumns: [sharedMembers.groupId, sharedMembers.id] }),
  foreignKey({ columns: [t.groupId, t.bookId], foreignColumns: [sharedBooks.groupId, sharedBooks.id] })]);
export const sharedBookVotes = sqliteTable("shared_book_votes", {
  groupId: sharedGroupId(), memberId: integer("member_id").notNull(), roadmapId: integer("roadmap_id").notNull(), createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.groupId, t.memberId] }),
  foreignKey({ columns: [t.groupId, t.memberId], foreignColumns: [sharedMembers.groupId, sharedMembers.id] }),
  foreignKey({ columns: [t.groupId, t.roadmapId], foreignColumns: [sharedRoadmap.groupId, sharedRoadmap.id] })]);
export const sharedClubSettings = sqliteTable("shared_club_settings", {
  groupId: sharedGroupId(), key: text("key").notNull(), value: text("value").notNull(),
}, (t) => [primaryKey({ columns: [t.groupId, t.key] })]);
export const sharedGroupAccountLinks = sqliteTable("shared_group_account_links", {
  groupId: sharedGroupId(), accountMemberId: integer("account_member_id").notNull().references(() => members.id), memberId: integer("member_id").notNull(),
}, (t) => [primaryKey({ columns: [t.groupId, t.accountMemberId] }), unique().on(t.groupId, t.memberId),
  index("shared_group_account_links_account").on(t.accountMemberId, t.groupId),
  foreignKey({ columns: [t.groupId, t.memberId], foreignColumns: [sharedMembers.groupId, sharedMembers.id] })]);
