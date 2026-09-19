/**
 * Writes a value to a dot-separated path in an object, creating intermediate objects as needed.
 */
export function setNestedValue(object: Record<string, any>, path: string, value: any): void {
  const parts = path.split('.');
  let current = object;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!part) continue;
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }
  const lastPart = parts[parts.length - 1];
  if (lastPart) current[lastPart] = value;
}
