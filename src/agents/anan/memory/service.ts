export async function resolveMemoryContext(userId: string): Promise<string> {
  return `user:${userId}`;
}
