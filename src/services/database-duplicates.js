export function databaseConnectionKey(database) {
  const host = String(database.host || '').trim().toLowerCase();
  const name = String(database.databaseName || '').trim().toLowerCase();
  if (!host || !name) return null;
  const port = Number(database.port) || 5432;
  return `${host}:${port}/${name}`;
}

export function dedupeDatabases(incoming, existing = []) {
  const ids = new Set(existing.map(database => database.id).filter(Boolean));
  const keys = new Set(existing.map(databaseConnectionKey).filter(Boolean));
  const unique = [];
  const duplicates = [];

  for (const database of incoming) {
    const key = databaseConnectionKey(database);
    if ((database.id && ids.has(database.id)) || (key && keys.has(key))) {
      duplicates.push(database);
      continue;
    }
    unique.push(database);
    if (database.id) ids.add(database.id);
    if (key) keys.add(key);
  }

  return {unique, duplicates};
}
