export class TimedCache<T> {
  private value: T | undefined
  private expiresAt = 0
  private pending: Promise<T> | undefined

  constructor(
    private readonly loader: () => Promise<T>,
    private readonly ttlMilliseconds: number,
  ) {}

  async get(): Promise<T> {
    const now = Date.now()
    if (this.value !== undefined && now < this.expiresAt) return this.value
    if (this.pending) return this.pending

    this.pending = this.loader()
    try {
      const loaded = await this.pending
      this.value = loaded
      this.expiresAt = Date.now() + this.ttlMilliseconds
      return loaded
    } finally {
      this.pending = undefined
    }
  }

  clear() {
    this.value = undefined
    this.expiresAt = 0
  }
}
