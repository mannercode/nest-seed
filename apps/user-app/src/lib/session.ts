const TOKEN_KEY = 'user-app:access-token'
const EMAIL_KEY = 'user-app:email'

export function saveSession(accessToken: string, email: string): void {
    sessionStorage.setItem(TOKEN_KEY, accessToken)
    sessionStorage.setItem(EMAIL_KEY, email)
}

export function readEmail(): string | null {
    if (typeof window === 'undefined') return null
    return sessionStorage.getItem(EMAIL_KEY)
}

export function clearSession(): void {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(EMAIL_KEY)
}
