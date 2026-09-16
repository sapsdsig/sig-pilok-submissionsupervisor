export function createRequestToken(now = new Date()): string {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '')
  return `${date}_${crypto.randomUUID()}`
}
