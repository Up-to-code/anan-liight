import { useMemo, useState, type ReactNode } from "react";

export interface ColumnDef<Row> {
  key: string;
  header: string;
  value: (row: Row) => ReactNode;
  sortable?: boolean;
  sortValue?: (row: Row) => string | number;
}

export function DataTable<Row extends { id?: string }>(props: {
  rows: Row[];
  columns: ColumnDef<Row>[];
  emptyText?: string;
}) {
  const [sortKey, setSortKey] = useState<string>("");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    if (!sortKey) return props.rows;
    const column = props.columns.find((col) => col.key === sortKey);
    if (!column) return props.rows;
    const getValue = column.sortValue ?? ((row: Row) => {
      const rendered = column.value(row);
      return typeof rendered === "string" || typeof rendered === "number" ? rendered : "";
    });

    const copied = [...props.rows];
    copied.sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      if (av < bv) return direction === "asc" ? -1 : 1;
      if (av > bv) return direction === "asc" ? 1 : -1;
      return 0;
    });
    return copied;
  }, [props.rows, props.columns, sortKey, direction]);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {props.columns.map((col) => (
              <th key={col.key}>
                {col.sortable ? (
                  <button
                    className="sort-btn"
                    onClick={() => {
                      if (sortKey === col.key) {
                        setDirection((current) => (current === "asc" ? "desc" : "asc"));
                        return;
                      }
                      setSortKey(col.key);
                      setDirection("desc");
                    }}
                  >
                    {col.header}
                    {sortKey === col.key ? (direction === "asc" ? " ▲" : " ▼") : ""}
                  </button>
                ) : col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={props.columns.length} className="empty-cell">{props.emptyText ?? "No data"}</td>
            </tr>
          ) : (
            sorted.map((row, idx) => (
              <tr key={row.id ?? `${idx}`}>
                {props.columns.map((col) => (
                  <td key={col.key}>{col.value(row)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
