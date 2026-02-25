export interface TableDefinition {
  tableName: string;
  createSql: string;
  indexes: string[];
}

export interface VersionedRow {
  id: string;
  version: number;
  createdAt: number;
  updatedAt: number;
}
