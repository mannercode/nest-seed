/**
 * 로그인에서 받은 액세스 토큰을 `sessionStorage`에 둔다.
 * 시드 수준이라 리프레시 토큰은 다루지 않고, 만료되면 다시 로그인한다.
 */

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
