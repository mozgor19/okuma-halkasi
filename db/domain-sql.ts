export const domainTables = [
  "members", "books", "meetings", "attendance", "meeting_rsvps", "reviews",
  "media", "photos", "roadmap", "favorite_books", "book_votes", "club_settings", "group_account_links",
] as const;
export type DomainTable = typeof domainTables[number];
export const communicationTables = ["meeting_details", "meeting_change_events"] as const;
type ExtraTable = typeof communicationTables[number];
type WritableTable = DomainTable | ExtraTable;

export function sharedRoutingKey(groupId: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(groupId) || groupId === "default") throw Error("INVALID_SHARED_GROUP");
  return "SHARED_" + groupId.replaceAll("-", "_").toUpperCase();
}

// Explicit query construction, not SQL rewriting. Read CTEs scope every joined
// domain table; mutation targets and conflict keys always carry the same tenant.
export class DomainDatabase {
  private readonly prefix: string;
  private readonly scope: string;
  constructor(private readonly db: D1Database, readonly sharedGroupId?: string) {
    if (sharedGroupId) sharedRoutingKey(sharedGroupId);
    this.scope = sharedGroupId ? `group_id = '${sharedGroupId}'` : "1";
    this.prefix = sharedGroupId
      ? `WITH ${domainTables.map((table) => `${table} AS (SELECT * FROM shared_${table} WHERE ${this.scope})`).join(", ")} `
      : "";
  }
  private table(table: WritableTable) {
    if (![...domainTables, ...communicationTables].includes(table)) throw Error("INVALID_DOMAIN_TABLE");
    return this.sharedGroupId ? "shared_" + table : table;
  }
  read(sql: string, extra: readonly ExtraTable[] = []): D1PreparedStatement {
    if (!/^\s*SELECT\b/i.test(sql)) throw Error("DOMAIN_READ_REQUIRED");
    if (extra.some((table) => !communicationTables.includes(table))) throw Error("INVALID_DOMAIN_TABLE");
    const prefix = this.sharedGroupId && extra.length
      ? this.prefix.slice(0, -1) + ", " + [...new Set(extra)].map((table) => `${table} AS (SELECT * FROM shared_${table} WHERE ${this.scope})`).join(", ") + " "
      : this.prefix;
    return this.db.prepare(prefix + sql);
  }
  insert(table: WritableTable, columns: string, values: string, options: { ignore?: boolean; conflict?: string; update?: string } = {}) {
    const target = this.table(table);
    const tenantColumn = this.sharedGroupId ? "group_id, " : "";
    const tenantValue = this.sharedGroupId ? `'${this.sharedGroupId}', ` : "";
    const conflict = options.conflict
      ? ` ON CONFLICT(${tenantColumn}${options.conflict}) DO ${options.update ? "UPDATE SET " + options.update : "NOTHING"}` : "";
    return this.db.prepare(`${this.prefix}INSERT ${options.ignore ? "OR IGNORE " : ""}INTO ${target} (${tenantColumn}${columns}) VALUES (${tenantValue}${values})${conflict}`);
  }
  insertSelect(table: WritableTable, columns: string, projection: string, source: string, options: { conflict?: string; update?: string } = {}) {
    const tenantColumn = this.sharedGroupId ? "group_id, " : "";
    const tenantValue = this.sharedGroupId ? `'${this.sharedGroupId}', ` : "";
    const conflict = options.conflict ? ` ON CONFLICT(${tenantColumn}${options.conflict}) DO ${options.update ? "UPDATE SET " + options.update : "NOTHING"}` : "";
    return this.db.prepare(`${this.prefix}INSERT INTO ${this.table(table)} (${tenantColumn}${columns}) SELECT ${tenantValue}${projection} ${source}${conflict}`);
  }
  update(table: WritableTable, assignments: string, where: string) {
    return this.db.prepare(`${this.prefix}UPDATE ${this.table(table)} SET ${assignments} WHERE ${this.scope} AND (${where})`);
  }
  delete(table: WritableTable, where = "1") {
    return this.db.prepare(`${this.prefix}DELETE FROM ${this.table(table)} WHERE ${this.scope} AND (${where})`);
  }
  batch<T = unknown>(statements: D1PreparedStatement[]) { return this.db.batch<T>(statements); }
}
