import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { AppError } from "@lib/errors/app-error";
import type { AppEnv } from "@lib/config/env";
import { toSpacetimeTableName } from "@lib/spacetime/table-name";

const execFileAsync = promisify(execFile);
const TABLE_NAME_REGEX = /^[a-z][a-z0-9_]*$/;

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
      `INSERT INTO ${sqlTable} (id, payloadJson, version, createdAt, updatedAt) VALUES (` +
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
    const sql = `SELECT payloadJson FROM ${sqlTable} LIMIT ${fetchLimit}`;
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
      `SELECT payloadJson FROM ${sqlTable} WHERE id = ${sqlLiteral(id)} LIMIT 1`
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
      `UPDATE ${sqlTable} SET payloadJson = ${sqlLiteral(nextPayload)}, ` +
      `version = ${sqlLiteral(String(expectedVersion + 1))}, ` +
      `updatedAt = ${sqlLiteral(String(Date.now()))} ` +
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

/**
 * Spacetime store adapter. Uses in-memory storage in test runtime and SQL CLI elsewhere.
 */
export class SpacetimeHttpStore implements SpacetimeStore {
  private readonly delegate: SpacetimeStore;

  public constructor(env: AppEnv) {
    this.delegate = env.NODE_ENV === "test" ? new MemorySpacetimeStore() : new SpacetimeCliStore(env);
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
