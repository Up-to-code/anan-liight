import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { AppError } from "@lib/errors/app-error";
import type { AppEnv } from "@lib/config/env";
import { toSpacetimeTableName } from "@lib/spacetime/table-name";

const execFileAsync = promisify(execFile);
const TABLE_NAME_REGEX = /^[a-z][a-z0-9_]*$/;
const COLUMN_NAME_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

export interface QueryFilter {
  field: string;
  op: "eq";
  value: string | number | boolean;
}

export interface SpacetimeStore {
  insert<T extends object>(table: string, row: T): Promise<void>;
  queryOne<T extends object>(table: string, filters: QueryFilter[]): Promise<T | null>;
  queryMany<T extends object>(table: string, filters: QueryFilter[], limit: number): Promise<T[]>;
  updateVersioned<T extends object>(
    table: string,
    id: string,
    expectedVersion: number,
    patch: Partial<T>
  ): Promise<boolean>;
}

type JsonRow = Record<string, unknown>;

function assertTableName(table: string): void {
  if (TABLE_NAME_REGEX.test(table)) return;
  throw new AppError({
    code: "VALIDATION_ERROR",
    message: `Invalid table name: ${table}`,
    payload: { reason: "Table names must be snake_case identifiers" },
    retryable: false
  });
}

function toSqlTable(table: string): string {
  const normalized = toSpacetimeTableName(table);
  assertTableName(normalized);
  return normalized;
}

function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

function sqlLiteral(value: string): string {
  return `'${sqlEscape(value)}'`;
}

function assertColumnName(column: string): void {
  if (COLUMN_NAME_REGEX.test(column)) return;
  throw new AppError({
    code: "VALIDATION_ERROR",
    message: `Invalid column name: ${column}`,
    payload: { reason: "Column names must be SQL identifiers" },
    retryable: false
  });
}

function stripWarnings(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("WARNING:"));
}

function parseSingleColumnRows(raw: string): string[] {
  const lines = stripWarnings(raw);
  return lines
    .filter((line) => line.startsWith('"') && line.endsWith('"'))
    .map((line) => line.slice(1, -1));
}

function matchesFilters(row: JsonRow, filters: QueryFilter[]): boolean {
  return filters.every((filter) => {
    if (filter.op !== "eq") return false;
    return String(row[filter.field]) === String(filter.value);
  });
}

function ensureObject<T extends object>(value: unknown): T {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AppError({
      code: "MALFORMED_RESPONSE",
      message: "Spacetime store row is not an object",
      payload: { provider: "spacetimedb", model: "sql-store" },
      retryable: true
    });
  }
  return value as T;
}

class MemorySpacetimeStore implements SpacetimeStore {
  private readonly rows = new Map<string, Map<string, JsonRow>>();

  public async insert<T extends object>(table: string, row: T): Promise<void> {
    const data = ensureObject<JsonRow>(row);
    const id = String(data["id"] ?? "");
    if (!id) throw new Error(`Missing id for table ${table}`);
    const tableRows = this.rows.get(table) ?? new Map<string, JsonRow>();
    tableRows.set(id, { ...data });
    this.rows.set(table, tableRows);
  }

  public async queryOne<T extends object>(table: string, filters: QueryFilter[]): Promise<T | null> {
    const tableRows = this.rows.get(table);
    if (!tableRows) return null;
    for (const row of tableRows.values()) {
      if (matchesFilters(row, filters)) return row as T;
    }
    return null;
  }

  public async queryMany<T extends object>(table: string, filters: QueryFilter[], limit: number): Promise<T[]> {
    const tableRows = this.rows.get(table);
    if (!tableRows) return [];
    const result: T[] = [];
    for (const row of tableRows.values()) {
      if (!matchesFilters(row, filters)) continue;
      result.push(row as T);
      if (result.length >= limit) break;
    }
    return result;
  }

  public async updateVersioned<T extends object>(
    table: string,
    id: string,
    expectedVersion: number,
    patch: Partial<T>
  ): Promise<boolean> {
    const tableRows = this.rows.get(table);
    if (!tableRows) return false;
    const current = tableRows.get(id);
    if (!current) return false;
    const version = Number(current["version"] ?? 0);
    if (version !== expectedVersion) return false;
    tableRows.set(id, {
      ...current,
      ...(patch as JsonRow),
      version: expectedVersion + 1,
      updatedAt: Date.now()
    });
    return true;
  }
}

class SpacetimeCliStore implements SpacetimeStore {
  public constructor(private readonly env: AppEnv) {}

  public async insert<T extends object>(table: string, row: T): Promise<void> {
    const sqlTable = toSqlTable(table);
    const data = ensureObject<JsonRow>(row);
    const id = String(data["id"] ?? "");
    if (!id) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: `insert requires row.id for table ${sqlTable}`,
        payload: { reason: "Missing row.id" },
        retryable: false
      });
    }
    const payload = JSON.stringify(data);
    const version = String(data["version"] ?? 1);
    const createdAt = String(data["createdAt"] ?? Date.now());
    const updatedAt = String(data["updatedAt"] ?? Date.now());
    const sql =
      `INSERT INTO ${sqlTable} (id, payload_json, version, created_at, updated_at) VALUES (` +
      `${sqlLiteral(id)}, ${sqlLiteral(payload)}, ${sqlLiteral(version)}, ` +
      `${sqlLiteral(createdAt)}, ${sqlLiteral(updatedAt)})`;
    await this.runSql(sql);
  }

  public async queryOne<T extends object>(table: string, filters: QueryFilter[]): Promise<T | null> {
    const rows = await this.queryMany<T>(table, filters, 1);
    return rows[0] ?? null;
  }

  public async queryMany<T extends object>(
    table: string,
    filters: QueryFilter[],
    limit: number
  ): Promise<T[]> {
    const sqlTable = toSqlTable(table);
    const fetchLimit = Math.max(limit * 5, 200);
    const sql = `SELECT payload_json FROM ${sqlTable} LIMIT ${fetchLimit}`;
    const raw = await this.runSql(sql);
    const payloadRows = parseSingleColumnRows(raw);
    const decoded = payloadRows
      .map((payload) => JSON.parse(payload) as JsonRow)
      .filter((row) => matchesFilters(row, filters))
      .slice(0, limit);
    return decoded.map((row) => row as T);
  }

  public async updateVersioned<T extends object>(
    table: string,
    id: string,
    expectedVersion: number,
    patch: Partial<T>
  ): Promise<boolean> {
    const sqlTable = toSqlTable(table);
    const raw = await this.runSql(
      `SELECT payload_json FROM ${sqlTable} WHERE id = ${sqlLiteral(id)} LIMIT 1`
    );
    const payload = parseSingleColumnRows(raw)[0];
    if (!payload) return false;
    const current = JSON.parse(payload) as JsonRow;
    const version = Number(current["version"] ?? 0);
    if (version !== expectedVersion) return false;
    const nextRow: JsonRow = {
      ...current,
      ...(patch as JsonRow),
      version: expectedVersion + 1,
      updatedAt: Date.now()
    };
    const nextPayload = JSON.stringify(nextRow);
    const sql =
      `UPDATE ${sqlTable} SET payload_json = ${sqlLiteral(nextPayload)}, ` +
      `version = ${sqlLiteral(String(expectedVersion + 1))}, ` +
      `updated_at = ${sqlLiteral(String(Date.now()))} ` +
      `WHERE id = ${sqlLiteral(id)} AND version = ${sqlLiteral(String(expectedVersion))}`;
    await this.runSql(sql);
    return true;
  }

  private async runSql(query: string): Promise<string> {
    try {
      const { stdout, stderr } = await execFileAsync(
        "spacetime",
        [
          "sql",
          "-s",
          this.env.SPACETIMEDB_HTTP_URL,
          this.env.SPACETIMEDB_DB_NAME,
          query,
          "-y"
        ],
        { timeout: 20_000, maxBuffer: 5 * 1024 * 1024 }
      );
      const output = `${stdout ?? ""}\n${stderr ?? ""}`;
      if (output.toLowerCase().includes("error:")) {
        throw new Error(output.trim());
      }
      return output;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Spacetime SQL call failed";
      throw new AppError({
        code: "EXTERNAL_PROVIDER_ERROR",
        message: "Spacetime SQL request failed",
        payload: { provider: "spacetimedb", detail },
        retryable: true,
        cause: error
      });
    }
  }
}

interface SqlQueryResult {
  schema?: {
    elements?: Array<{ name?: { some?: string } | { none?: null }; algebraic_type?: unknown }>;
  };
  rows?: unknown[][];
  total_duration_micros?: number;
}

interface ParsedSqlTable {
  columns: string[];
  rows: string[][];
}

function decodeSqlCell(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || typeof value === "undefined") return "";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    // Option encoding: { some: ... } / { none: null }
    if ("some" in record) return decodeSqlCell(record["some"]);
    if ("none" in record) return "";
  }
  return String(value);
}

function parseSqlTables(response: unknown): ParsedSqlTable[] {
  if (!Array.isArray(response)) return [];
  const tables: ParsedSqlTable[] = [];
  for (const entry of response as SqlQueryResult[]) {
    const columns = (Array.isArray(entry.schema?.elements) ? entry.schema?.elements : [])
      .map((element) => {
        const nameValue = element?.name;
        if (!nameValue || typeof nameValue !== "object") return "";
        if ("some" in nameValue && typeof nameValue.some === "string") return nameValue.some;
        return "";
      })
      .filter((name) => name.length > 0);
    const rows = Array.isArray(entry.rows) ? entry.rows : [];
    const parsedRows: string[][] = [];
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      parsedRows.push(row.map((cell) => decodeSqlCell(cell)));
    }
    tables.push({ columns, rows: parsedRows });
  }
  return tables;
}

function parseSqlRows(response: unknown): string[][] {
  return parseSqlTables(response).flatMap((table) => table.rows);
}

function sqlCellToValue(value: string): string | number | boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  if (/^-?\d+\.\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return value;
}

function toSqlObjectRows(response: unknown): JsonRow[] {
  const tables = parseSqlTables(response);
  const objects: JsonRow[] = [];
  for (const table of tables) {
    const columns = table.columns;
    for (const row of table.rows) {
      const obj: JsonRow = {};
      for (let index = 0; index < row.length; index += 1) {
        const key = columns[index] ?? `col${index}`;
        obj[key] = sqlCellToValue(row[index] ?? "");
      }
      objects.push(obj);
    }
  }
  return objects;
}

function toSqlValue(value: unknown): string {
  if (value === null || typeof value === "undefined") return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "NULL";
    return String(value);
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "string") return sqlLiteral(value);
  return sqlLiteral(JSON.stringify(value));
}

class SpacetimeSqlHttpStore implements SpacetimeStore {
  private readonly tableModeCache = new Map<string, "payload" | "columns">();

  public constructor(private readonly env: AppEnv) {}

  public async insert<T extends object>(table: string, row: T): Promise<void> {
    const sqlTable = toSqlTable(table);
    const data = ensureObject<JsonRow>(row);
    const id = String(data["id"] ?? "");
    if (!id) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: `insert requires row.id for table ${sqlTable}`,
        payload: { reason: "Missing row.id" },
        retryable: false
      });
    }

    const mode = await this.detectTableMode(sqlTable);
    const sql = mode === "payload"
      ? this.buildPayloadInsertSql(sqlTable, data)
      : this.buildColumnInsertSql(sqlTable, data);
    await this.runSql(sql);
  }

  public async queryOne<T extends object>(table: string, filters: QueryFilter[]): Promise<T | null> {
    const rows = await this.queryMany<T>(table, filters, 1);
    return rows[0] ?? null;
  }

  public async queryMany<T extends object>(table: string, filters: QueryFilter[], limit: number): Promise<T[]> {
    const sqlTable = toSqlTable(table);
    const fetchLimit = Math.max(limit * 5, 200);
    const mode = await this.detectTableMode(sqlTable);
    if (mode === "payload") {
      const sql = `SELECT payload_json FROM ${sqlTable} LIMIT ${fetchLimit}`;
      const rowData = parseSqlRows(await this.runSql(sql));
      const payloadRows = rowData.map((row) => row[0] ?? "").filter((value) => value.length > 0);
      const decoded = payloadRows
        .map((payload) => JSON.parse(payload) as JsonRow)
        .filter((row) => matchesFilters(row, filters))
        .slice(0, limit);
      return decoded.map((row) => row as T);
    }

    const sql = `SELECT * FROM ${sqlTable} LIMIT ${fetchLimit}`;
    const rows = toSqlObjectRows(await this.runSql(sql))
      .filter((row) => matchesFilters(row, filters))
      .slice(0, limit);
    return rows.map((row) => row as T);
  }

  public async updateVersioned<T extends object>(
    table: string,
    id: string,
    expectedVersion: number,
    patch: Partial<T>
  ): Promise<boolean> {
    const sqlTable = toSqlTable(table);
    const mode = await this.detectTableMode(sqlTable);
    const current = await this.queryOne<JsonRow>(table, [{ field: "id", op: "eq", value: id }]);
    if (!current) return false;

    const version = Number(current["version"] ?? 0);
    if (version !== expectedVersion) return false;

    const nextRow: JsonRow = {
      ...current,
      ...(patch as JsonRow),
      version: expectedVersion + 1,
      updatedAt: Date.now()
    };

    const sql = mode === "payload"
      ? this.buildPayloadUpdateSql(sqlTable, id, expectedVersion, nextRow)
      : this.buildColumnUpdateSql(sqlTable, id, expectedVersion, nextRow);
    await this.runSql(sql);
    return true;
  }

  private buildPayloadInsertSql(sqlTable: string, data: JsonRow): string {
    const payload = JSON.stringify(data);
    const version = String(data["version"] ?? 1);
    const createdAt = String(data["createdAt"] ?? Date.now());
    const updatedAt = String(data["updatedAt"] ?? Date.now());
    return (
      `INSERT INTO ${sqlTable} (id, payload_json, version, created_at, updated_at) VALUES (` +
      `${sqlLiteral(String(data["id"]))}, ${sqlLiteral(payload)}, ${sqlLiteral(version)}, ` +
      `${sqlLiteral(createdAt)}, ${sqlLiteral(updatedAt)})`
    );
  }

  private buildColumnInsertSql(sqlTable: string, data: JsonRow): string {
    const keys = Object.keys(data);
    for (const key of keys) assertColumnName(key);
    const columns = keys.join(", ");
    const values = keys.map((key) => toSqlValue(data[key])).join(", ");
    return `INSERT INTO ${sqlTable} (${columns}) VALUES (${values})`;
  }

  private buildPayloadUpdateSql(sqlTable: string, id: string, expectedVersion: number, nextRow: JsonRow): string {
    const nextPayload = JSON.stringify(nextRow);
    return (
      `UPDATE ${sqlTable} SET payload_json = ${sqlLiteral(nextPayload)}, ` +
      `version = ${sqlLiteral(String(expectedVersion + 1))}, ` +
      `updated_at = ${sqlLiteral(String(Date.now()))} ` +
      `WHERE id = ${sqlLiteral(id)} AND version = ${sqlLiteral(String(expectedVersion))}`
    );
  }

  private buildColumnUpdateSql(sqlTable: string, id: string, expectedVersion: number, nextRow: JsonRow): string {
    const assignments = Object.entries(nextRow)
      .filter(([key]) => key !== "id")
      .map(([key, value]) => {
        assertColumnName(key);
        return `${key} = ${toSqlValue(value)}`;
      })
      .join(", ");
    return (
      `UPDATE ${sqlTable} SET ${assignments} ` +
      `WHERE id = ${sqlLiteral(id)} AND version = ${String(expectedVersion)}`
    );
  }

  private async detectTableMode(sqlTable: string): Promise<"payload" | "columns"> {
    const cached = this.tableModeCache.get(sqlTable);
    if (cached) return cached;

    const response = await this.runSql(`SELECT * FROM ${sqlTable} LIMIT 1`);
    const tables = parseSqlTables(response);
    const columns = tables[0]?.columns ?? [];
    const mode: "payload" | "columns" = columns.includes("payload_json") ? "payload" : "columns";
    this.tableModeCache.set(sqlTable, mode);
    return mode;
  }

  private async runSql(query: string): Promise<unknown> {
    const endpoint = `${this.env.SPACETIMEDB_HTTP_URL.replace(/\/$/, "")}/v1/database/${this.env.SPACETIMEDB_DB_NAME}/sql`;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          ...(this.env.SPACETIMEDB_AUTH_TOKEN ? { Authorization: `Bearer ${this.env.SPACETIMEDB_AUTH_TOKEN}` } : {})
        },
        body: query
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      if (!text.trim()) return [];
      return JSON.parse(text) as unknown;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Spacetime HTTP SQL call failed";
      throw new AppError({
        code: "EXTERNAL_PROVIDER_ERROR",
        message: "Spacetime SQL request failed",
        payload: { provider: "spacetimedb", detail: `[sql_http] ${endpoint} :: ${detail}` },
        retryable: true,
        cause: error
      });
    }
  }
}

/**
 * Spacetime store adapter. Uses in-memory storage in test runtime and SQL CLI elsewhere.
 */
export class SpacetimeHttpStore implements SpacetimeStore {
  private readonly delegate: SpacetimeStore;

  public constructor(env: AppEnv) {
    if (env.NODE_ENV === "test") {
      this.delegate = new MemorySpacetimeStore();
      return;
    }
    this.delegate = env.SPACETIME_STORE_MODE === "cli" ? new SpacetimeCliStore(env) : new SpacetimeSqlHttpStore(env);
  }

  public insert<T extends object>(table: string, row: T): Promise<void> {
    return this.delegate.insert(table, row);
  }

  public queryOne<T extends object>(table: string, filters: QueryFilter[]): Promise<T | null> {
    return this.delegate.queryOne<T>(table, filters);
  }

  public queryMany<T extends object>(table: string, filters: QueryFilter[], limit: number): Promise<T[]> {
    return this.delegate.queryMany<T>(table, filters, limit);
  }

  public updateVersioned<T extends object>(
    table: string,
    id: string,
    expectedVersion: number,
    patch: Partial<T>
  ): Promise<boolean> {
    return this.delegate.updateVersioned(table, id, expectedVersion, patch);
  }
}
