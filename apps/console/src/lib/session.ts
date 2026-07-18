const TOKEN_KEY = 'console:access-token'

export function saveSession(accessToken: string): void {
    sessionStorage.setItem(TOKEN_KEY, accessToken)
}

export function readToken(): string | null {
    if (typeof window === 'undefined') return null
    return sessionStorage.getItem(TOKEN_KEY)
}

export function clearSession(): void {
    sessionStorage.removeItem(TOKEN_KEY)
}
