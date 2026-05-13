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

    it('순환 참조는 [CIRCULAR]로 치환하고 스택 오버플로 없이 끝낸다', () => {
        const a: any = { password: 'secret', name: 'a' }
        a.self = a

        const result = redactSensitive(a)

        expect(result.password).toBe('[REDACTED]')
        expect(result.self).toBe('[CIRCULAR]')
    })

    it('서로 다른 위치에서 같은 객체를 참조하면 양쪽 모두 [CIRCULAR]로 치환한다', () => {
        // 구현이 WeakSet으로 방문을 추적하므로 DAG에서 두 번째 방문도 [CIRCULAR]가 된다.
        const shared = { name: 'shared' }
        const root = { a: shared, b: shared }

        const result = redactSensitive(root) as any

        // 첫 방문은 정상 처리하고, 두 번째 방문은 [CIRCULAR]로 축약한다.
        const visitedAsObject = result.a !== '[CIRCULAR]' ? result.a : result.b
        const visitedAsCircular = result.a === '[CIRCULAR]' ? result.a : result.b

        expect(visitedAsObject).toEqual({ name: 'shared' })
        expect(visitedAsCircular).toBe('[CIRCULAR]')
    })

    it('배열이 자기 자신을 원소로 포함해도 [CIRCULAR]로 치환한다', () => {
        const arr: any[] = [1, 2]
        arr.push(arr)

        const result = redactSensitive(arr)

        expect(result.slice(0, 2)).toEqual([1, 2])
        expect(result[2]).toBe('[CIRCULAR]')
    })

    it('중첩된 배열 안의 객체에서도 민감 키만 [REDACTED]되고 나머지는 유지된다', () => {
        const result = redactSensitive([[{ name: 'a', password: 'p1' }, { token: 't1' }]]) as any

        expect(result).toEqual([[{ name: 'a', password: '[REDACTED]' }, { token: '[REDACTED]' }]])
    })

    it('정확히 일치하지 않는 변형 키(pwd, userSecret, apiToken 등)는 마스킹하지 않는다', () => {
        // 'secret', 'apikey'는 SENSITIVE_FIELDS에 있지만 'userSecret', 'apiToken'은 부분 일치라 통과한다.
        const result = redactSensitive({
            pwd: 'p1',
            userSecret: 's1',
            apiToken: 't1',
            accessTokenString: 'a1'
        })

        expect(result).toEqual({
            pwd: 'p1',
            userSecret: 's1',
            apiToken: 't1',
            accessTokenString: 'a1'
        })
    })

    it('prototype 체인으로 상속된 민감 필드는 마스킹하지 않는다', () => {
        // Object.entries는 own enumerable만 본다.
        const proto = { password: 'should-leak' }
        const obj = Object.create(proto)
        obj.name = 'x'

        const result = redactSensitive(obj)

        expect(result).toEqual({ name: 'x' })
    })
})
