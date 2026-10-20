import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { DatabaseSync, constants } from "node:sqlite";
import { production } from "./web-production-policy.mjs";

export const ownershipTable = "_koru_restore_drill_owner";
const scratchTable = "_koru_restore_drill_bytes";
export const catalogSql = "SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND name NOT IN ('_cf_KV','_cf_METADATA') AND sql IS NOT NULL ORDER BY type,name";
export const digest = (value) => createHash("sha256").update(value).digest("hex");
export function identifier(value) {
  assert.equal(typeof value, "string");
  assert.ok(value.length && !value.includes("\0"));
  return '"' + value.replaceAll('"', '""') + '"';
}
export function assertBackupSourceBindings(bindings) {
  const databases = bindings.filter((item) => item.type === "d1");
  const names = databases.map((item) => item.name).sort();
  assert.deepEqual(names, databases.length === 1 ? ["DB"] : ["DB", "GROUP_CREATE_ONE", "GROUP_CREATE_TWO"], "Unexpected backup source bindings");
  assert.equal(databases.find((item) => item.name === "DB")?.database_id, production.canonicalDatabaseId, "Unexpected canonical backup source");
  assert.equal(new Set(databases.map((item) => item.database_id)).size, databases.length, "Aliased backup source bindings");
  assert.ok(databases.every((item) => /^[a-f0-9-]{36}$/.test(item.database_id ?? "")), "Invalid backup source identity");
}
export function assertFreeCapacity(databases, sourceId) {
  assert.ok(Array.isArray(databases) && databases.length < 10, "D1 Free database capacity unavailable");
  assert.equal(new Set(databases.map((item) => item.uuid)).size, databases.length);
  const source = databases.find((item) => item.uuid === sourceId);
  assert.ok(source && sourceId === production.canonicalDatabaseId, "Unexpected source database");
  assert.ok(databases.every((item) => Number.isSafeInteger(item.file_size) && item.file_size >= 0), "Storage metadata incomplete");
  assert.ok(source.file_size <= 20 * 1024 * 1024, "Source exceeds this bounded drill budget");
  assert.ok(databases.reduce((sum, item) => sum + item.file_size, 0) + source.file_size + 10 * 1024 * 1024 < 5 * 1024 ** 3, "D1 Free storage capacity unavailable");
  return source;
}
export function assertDrillTarget(target, { runId, name, existingIds, bindings }) {
  assert.match(runId, /^[a-f0-9-]{36}$/);
  assert.equal(name, "koru-restore-drill-" + runId);
  assert.equal(target.name, name);
  assert.match(target.uuid, /^[a-f0-9-]{36}$/);
  assert.notEqual(target.uuid, production.canonicalDatabaseId);
  assert.ok(!existingIds.includes(target.uuid), "Existing database must never be a restore target");
  assert.ok(!bindings.some((binding) => binding.type === "d1" && binding.database_id === target.uuid), "Restore database is bound to a Worker");
}
export function sealSql(sql, key, metadata) {
  assert.equal(key.length, 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(JSON.stringify(metadata)));
  const data = Buffer.concat([cipher.update(sql, "utf8"), cipher.final()]);
  return JSON.stringify({ format: "koru-d1-encrypted-sql-v1", metadata,
    iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") });
}
export function openSql(envelope, key, expected) {
  const item = JSON.parse(envelope);
  assert.equal(item.format, "koru-d1-encrypted-sql-v1");
  assert.deepEqual(item.metadata, expected);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(item.iv, "base64"));
  decipher.setAAD(Buffer.from(JSON.stringify(item.metadata)));
  decipher.setAuthTag(Buffer.from(item.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(item.data, "base64")), decipher.final()]).toString("utf8");
}
export function openSnapshot(sql) {
  // Native dumps may insert child tables before parents. Parse offline first,
  // then explicitly validate every FK; the actual restore enables/defer-checks FKs.
  const db = new DatabaseSync(":memory:", { allowExtension: false, enableForeignKeyConstraints: false });
  db.setAuthorizer((action, first, second) => {
    if ([constants.SQLITE_ATTACH, constants.SQLITE_DETACH, constants.SQLITE_CREATE_VTABLE].includes(action)
      || (action === constants.SQLITE_FUNCTION && ["load_extension", "readfile", "writefile"].includes(second ?? first))) return constants.SQLITE_DENY;
    return constants.SQLITE_OK;
  });
  try {
    db.exec(sql);
    assert.equal(db.prepare("PRAGMA quick_check").get().quick_check, "ok");
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    return db;
  } catch { db.close(); throw Error("BACKUP_SNAPSHOT_INVALID; SQL and private values withheld"); }
}

// Encode integers as decimal text and text/BLOBs as hex, avoiding JSON precision
// loss, NUL truncation and accidental conversion of binary data into strings.
export function rowQuery(table, columns) {
  const cells = columns.map((name) => {
    const col = identifier(name);
    return `json_array(typeof(${col}), CASE typeof(${col}) WHEN 'blob' THEN hex(${col}) WHEN 'text' THEN hex(CAST(${col} AS BLOB)) WHEN 'real' THEN printf('%!.17g',${col}) ELSE CAST(${col} AS TEXT) END)`;
  });
  return `SELECT json_array(${cells.join(",")}) AS encoded FROM ${identifier(table)}`;
}
function canonicalRows(rows) { return rows.map((row) => row.encoded).sort(); }
export function describeSnapshot(db) {
  const schema = db.prepare(catalogSql).all();
  assert.ok(!schema.some((item) => [ownershipTable, scratchTable].includes(item.name) || /CREATE\s+VIRTUAL\s+TABLE/i.test(item.sql)));
  const tables = schema.filter((item) => item.type === "table").map((item) => {
    const info = db.prepare(`PRAGMA table_xinfo(${identifier(item.name)})`).all();
    const columns = info.filter((col) => col.hidden === 0).map((col) => col.name);
    assert.ok(columns.length && columns.length <= 40, "Unsupported table shape");
    const rows = canonicalRows(db.prepare(rowQuery(item.name, columns)).all());
    assert.ok(rows.length <= 10000, "Table exceeds drill row budget");
    return { name: item.name, columns, rows, count: rows.length, digest: digest(JSON.stringify(rows)) };
  });
  const sequence = db.prepare("SELECT name FROM sqlite_schema WHERE name='sqlite_sequence'").get()
    ? db.prepare("SELECT name,CAST(seq AS TEXT) AS seq FROM sqlite_sequence ORDER BY name").all() : [];
  return { schema, tables, sequence, schemaDigest: digest(JSON.stringify(schema)) };
}
function sqlCell([type, value]) {
  if (type === "null") { assert.equal(value, null); return "NULL"; }
  if (type === "integer") { assert.match(value, /^-?\d+$/); return `CAST('${value}' AS INTEGER)`; }
  if (type === "real") {
    assert.ok(value && Number.isFinite(Number(value)), "Non-finite numeric value requires review");
    assert.match(value, /^-?[\d.eE+-]+$/);
    return `CAST('${value}' AS REAL)`;
  }
  assert.ok(type === "blob" || type === "text");
  assert.match(value, /^(?:[A-F0-9]{2})*$/);
  return type === "blob" ? `X'${value}'` : `CAST(X'${value}' AS TEXT)`;
}
export function restoreSql(snapshot) {
  const statements = ["PRAGMA defer_foreign_keys=ON", ...snapshot.schema.filter((item) => item.type === "table").map((item) => item.sql),
    `CREATE TABLE ${identifier(scratchTable)} (id INTEGER PRIMARY KEY,data BLOB NOT NULL)`];
  for (const table of snapshot.tables) for (const row of table.rows) {
    const cells = JSON.parse(row);
    let scratchId = 0;
    const values = cells.map((cell) => {
      if (["text", "blob"].includes(cell[0]) && cell[1].length > 24000) {
        const id = ++scratchId;
        statements.push(`INSERT INTO ${identifier(scratchTable)} VALUES(${id},X'')`);
        for (let start = 0; start < cell[1].length; start += 24000)
          statements.push(`UPDATE ${identifier(scratchTable)} SET data=CAST(data||X'${cell[1].slice(start, start + 24000)}' AS BLOB) WHERE id=${id}`);
        return `(SELECT ${cell[0] === "text" ? "CAST(data AS TEXT)" : "data"} FROM ${identifier(scratchTable)} WHERE id=${id})`;
      }
      return sqlCell(cell);
    });
    statements.push(`INSERT INTO ${identifier(table.name)}(${table.columns.map(identifier).join(",")}) VALUES(${values.join(",")})`);
    if (scratchId) statements.push(`DELETE FROM ${identifier(scratchTable)}`);
  }
  if (snapshot.sequence.length) {
    statements.push("DELETE FROM sqlite_sequence");
    for (const row of snapshot.sequence) statements.push(`INSERT INTO sqlite_sequence(name,seq) VALUES(${sqlCell(["text", Buffer.from(row.name).toString("hex").toUpperCase()])},${sqlCell(["integer", row.seq])})`);
  }
  statements.push(`DROP TABLE ${identifier(scratchTable)}`,
    ...snapshot.schema.filter((item) => item.type !== "table").map((item) => item.sql));
  assert.ok(statements.length < 10000 && statements.every((sql) => Buffer.byteLength(sql) < 90000), "Restore statement budget exceeded");
  const sql = statements.join(";\n") + ";\n";
  assert.ok(Buffer.byteLength(sql) < 40 * 1024 * 1024, "Restore upload budget exceeded");
  return { sql, statements, statementCount: statements.length };
}
export async function verifySnapshot(snapshot, query) {
  const catalog = (await query(catalogSql)).filter((item) => item.name !== ownershipTable);
  assert.equal(digest(JSON.stringify(catalog)), snapshot.schemaDigest, "Restored schema mismatch");
  const checks = [];
  for (const table of snapshot.tables) {
    const rows = canonicalRows(await query(rowQuery(table.name, table.columns)));
    assert.equal(rows.length, table.count, "Restored table count mismatch");
    assert.equal(digest(JSON.stringify(rows)), table.digest, "Restored table bytes/values mismatch");
    checks.push({ table: table.name, rows: table.count, valuesMatch: true });
  }
  if (snapshot.sequence.length) assert.equal(JSON.stringify(await query("SELECT name,CAST(seq AS TEXT) AS seq FROM sqlite_sequence ORDER BY name")), JSON.stringify(snapshot.sequence));
  assert.deepEqual(await query("PRAGMA foreign_key_check"), [], "Restored foreign key violation");
  const quick = await query("PRAGMA quick_check");
  assert.equal(quick.length, 1);
  assert.equal(quick[0].quick_check, "ok");
  return checks;
}
