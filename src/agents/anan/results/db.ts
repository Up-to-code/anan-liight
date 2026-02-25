export interface DbPropertyRow {
  title?: string;
  propertyUrl?: string;
  address?: string;
  location?: string;
  price?: string | number;
  imageUrl?: string;
  imageUrls?: string[];
}

export function normalizeDbPropertyRows(rows: DbPropertyRow[]): Array<{
  title: string;
  propertyUrl: string;
  location?: string;
  price?: string;
  imageUrls?: string[];
}> {
  return rows
    .map((row) => ({
      title: (row.title ?? "Property").trim() || "Property",
      propertyUrl: (row.propertyUrl ?? "").trim(),
      ...(row.location || row.address
        ? { location: String(row.location ?? row.address).trim() }
        : {}),
      ...(row.price != null ? { price: String(row.price) } : {}),
      ...(Array.isArray(row.imageUrls)
        ? { imageUrls: row.imageUrls.filter(Boolean).slice(0, 8) }
        : row.imageUrl
          ? { imageUrls: [row.imageUrl] }
          : {}),
    }))
    .filter((item) => item.propertyUrl.length > 0);
}
