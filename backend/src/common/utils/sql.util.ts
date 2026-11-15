// "'A', 'B', 'C'" for use inside a CHECK (... IN (...)) expression
export function sqlIn(values: Record<string, string> | readonly string[]): string {
  const list = Array.isArray(values) ? values : Object.values(values);
  return list.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');
}
