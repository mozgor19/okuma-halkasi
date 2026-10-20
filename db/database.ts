import { env } from "cloudflare:workers";
import { AsyncLocalStorage } from "node:async_hooks";
import type { ReadingGroup } from "@/lib/types";
import { DomainDatabase } from "@/db/domain-sql";

export type ReadingGroupContext = {
  db: D1Database;
  accountMemberId: number;
  memberId: number;
  group: ReadingGroup;
  sharedGroupId?: string;
};

const requestDatabase = new AsyncLocalStorage<ReadingGroupContext>();

export function readingGroupsEnabled(): boolean {
  return env.READING_GROUPS_ENABLED === "true";
}

export function identityDatabase() {
  if (!env.DB) throw new Error("Veritabanı bağlı değil.");
  return env.DB;
}

export function readingGroupContext() {
  return requestDatabase.getStore();
}

export function runWithReadingGroup<T>(context: ReadingGroupContext, callback: () => T): T {
  return requestDatabase.run(context, callback);
}

export function database() {
  if (readingGroupContext()?.sharedGroupId) throw new Error("Shared groups require scoped domain access.");
  return readingGroupContext()?.db ?? identityDatabase();
}

export function domainDatabase() {
  const context = readingGroupContext();
  return new DomainDatabase(context?.db ?? identityDatabase(), context?.sharedGroupId);
}
