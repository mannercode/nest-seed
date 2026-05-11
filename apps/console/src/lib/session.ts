/**
 * 로그인 후 받은 access 토큰을 sessionStorage 에 저장. 데모 수준이라 refresh
 * 토큰은 다루지 않는다 (만료 시 다시 로그인).
 */

const TOKEN_KEY = 'console:access-token'
const EMAIL_KEY = 'console:email'

export function saveSession(accessToken: string, email: string): void {
    sessionStorage.setItem(TOKEN_KEY, accessToken)
    sessionStorage.setItem(EMAIL_KEY, email)
}

export function readToken(): string | null {
    if (typeof window === 'undefined') return null
    return sessionStorage.getItem(TOKEN_KEY)
}

export function readEmail(): string | null {
    if (typeof window === 'undefined') return null
    return sessionStorage.getItem(EMAIL_KEY)
}

export function clearSession(): void {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(EMAIL_KEY)
}
