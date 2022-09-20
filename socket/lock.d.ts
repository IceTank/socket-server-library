export class Lock {
  /**
   * Synchronous. Returns true if the lock was acquired. Return false if the lock is already held by something else.
   */
   tryAcquire (): boolean

  /**
   * Asynchronous. Resolves when the lock was acquired.
   */
  async acquire (): Promise<void>

  /**
   * Releases the lock.
   */
  release (): void
}