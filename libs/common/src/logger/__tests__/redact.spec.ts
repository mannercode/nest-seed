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

    it.todo('자기 참조 객체를 [CIRCULAR] 로 치환하고 stack overflow 없이 끝낸다')
    it.todo('서로 다른 두 sub-tree 가 같은 객체를 참조하면 양쪽 다 [CIRCULAR] 로 치환한다')
    it.todo('배열이 자기 자신을 원소로 포함할 때도 [CIRCULAR] 로 치환한다 (객체 cycle 과 별개의 분기)')
    it.todo('객체 안의 배열 안의 객체에서도 민감 키만 [REDACTED] 되고 나머지는 보존된다')
    it.todo(
        '변형 명명 (pwd, userSecret, apiToken, accessTokenString) 은 정확 매칭 설계상 redact 되지 않는다 (의도된 false-negative lock-down)'
    )
    it.todo(
        'Date/RegExp/Map/Set 같은 special object 도 Object.entries 기반 walk 가 그대로 통과시킨다 (deep copy 의 한계 lock-down)'
    )
    it.todo(
        'prototype chain 으로 상속된 password 필드는 Object.entries 가 보지 못해 redact 되지 않는다 (own property 만 검사하는 한계 lock-down)'
    )
})
