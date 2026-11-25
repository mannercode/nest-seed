export function userSessionKeys(prefix: string, userId: string) {
    const userKey = `${prefix}:{${userId}}`
    return {
        index: `${userKey}:sessions`,
        session: (sessionId: string) => `${userKey}:session:${sessionId}`
    }
}
