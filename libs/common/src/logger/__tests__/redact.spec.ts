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

    it.todo('순환 참조는 [CIRCULAR]로 치환하고 스택 오버플로 없이 끝낸다')
    it.todo('서로 다른 위치에서 같은 객체를 참조하면 양쪽 모두 [CIRCULAR]로 치환한다')
    it.todo('배열이 자기 자신을 원소로 포함해도 [CIRCULAR]로 치환한다')
    it.todo('중첩된 배열 안의 객체에서도 민감 키만 [REDACTED]되고 나머지는 유지된다')
    it.todo('정확히 일치하지 않는 변형 키(pwd, userSecret, apiToken 등)는 마스킹하지 않는다')
    it.todo('Date / RegExp / Map / Set은 deep copy 없이 그대로 통과한다')
    it.todo('prototype 체인으로 상속된 민감 필드는 마스킹하지 않는다')
})
