/**
 * Generate a sortable, URL-safe unique id for new records. Uses the Web Crypto
 * API which is available in the Node.js and Edge runtimes on Vercel.
 */
export function generateId(): string {
  return crypto.randomUUID();
}
