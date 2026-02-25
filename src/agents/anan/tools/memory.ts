export interface MemoryFact {
  key: string;
  value: string;
}

export async function storeMemoryFact(_fact: MemoryFact): Promise<void> {
  // Placeholder for parity implementation to map into persistent memory tables.
}
