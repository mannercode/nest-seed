export function cacheLockKey(key: string): string {
    return `lock:${key}`
}
