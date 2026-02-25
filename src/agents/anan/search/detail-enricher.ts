import type { PropertySearchResult } from "@agents/anan/tools/property";

export async function enrichSearchDetails(items: PropertySearchResult["items"]): Promise<PropertySearchResult["items"]> {
  return items.map((item) => ({
    ...item,
    ...(item.imageUrls && item.imageUrls.length > 0 ? {} : { imageUrls: [] }),
  }));
}
