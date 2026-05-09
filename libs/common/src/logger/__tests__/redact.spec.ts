import { redactSensitive } from '../redact'

describe('redactSensitive', () => {
    it('민감 키의 값을 [REDACTED]로 치환한다', () => {
        const result = redactSensitive({ email: 'a@b.com', password: 'secret' })

        expect(result).toEqual({ email: 'a@b.com', password: '[REDACTED]' })
    })

    it('키 비교는 대소문자를 구분하지 않는다', () => {
        const result = redactSensitive({ Password: 'p1', RefreshToken: 'r1', ACCESSTOKEN: 'a1' })

        expect(result).toEqual({
            Password: '[REDACTED]',
            RefreshToken: '[REDACTED]',
            ACCESSTOKEN: '[REDACTED]'
        })
    })

    it('중첩된 객체 안의 값도 치환한다', () => {
        const result = redactSensitive({ user: { name: 'kim', password: 'secret' } })

        expect(result).toEqual({ user: { name: 'kim', password: '[REDACTED]' } })
    })

    it('배열 요소 안의 객체도 치환한다', () => {
        const result = redactSensitive([{ token: 't1' }, { token: 't2' }])

        expect(result).toEqual([{ token: '[REDACTED]' }, { token: '[REDACTED]' }])
    })

    it('원본 객체를 변형하지 않는다', () => {
        const input = { password: 'secret' }
        redactSensitive(input)

        expect(input).toEqual({ password: 'secret' })
    })

    it('원시값은 그대로 반환한다', () => {
        expect(redactSensitive('hello')).toBe('hello')
        expect(redactSensitive(42)).toBe(42)
        expect(redactSensitive(null)).toBe(null)
        expect(redactSensitive(undefined as unknown)).toBe(undefined)
    })

    it('민감 키가 없으면 같은 모양을 유지한다', () => {
        const input = { a: 1, b: { c: [1, 2] } }

        expect(redactSensitive(input)).toEqual(input)
    })
})
