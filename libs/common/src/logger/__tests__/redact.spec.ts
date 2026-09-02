import { ObjectId } from 'mongodb'
import { redactSensitive } from '../index.js'

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

    it('Date 같은 클래스 인스턴스는 빈 객체로 만들지 않고 그대로 통과시킨다', () => {
        const createdAt = new Date('2026-01-02T03:04:05.000Z')
        const id = new ObjectId('64b7f8e2a1b2c3d4e5f60718')
        const result = redactSensitive({ createdAt, id, password: 'secret' })

        expect(result.createdAt).toBe(createdAt)
        expect(result.id).toBe(id)
        expect(result.password).toBe('[REDACTED]')
    })

    it('순환 참조는 [CIRCULAR]로 치환하고 스택 오버플로 없이 끝낸다', () => {
        const a: any = { password: 'secret', name: 'a' }
        a.self = a

        const result = redactSensitive(a)

        expect(result.password).toBe('[REDACTED]')
        expect(result.self).toBe('[CIRCULAR]')
    })

    it('서로 다른 위치에서 같은 객체를 참조하면 두 번째 방문부터 [CIRCULAR]로 치환한다', () => {
        // 구현이 WeakSet으로 방문을 추적하므로, 순환이 아닌 단순 공유 참조도 축약 대상이다.
        const shared = { name: 'shared' }
        const root = { a: shared, b: shared }

        const result = redactSensitive(root) as any

        expect(result.a).toEqual({ name: 'shared' })
        expect(result.b).toBe('[CIRCULAR]')
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

    it('S3 presigned URL은 url 키와 배열·중첩 위치에 관계없이 전체를 마스킹한다', () => {
        const presignedUrl =
            'https://storage.example.com/movie.jpg?X-Amz-Credential=credential-secret&X-Amz-Signature=signature-secret'
        const publicUrl = 'https://cdn.example.com/movie.jpg?width=640&format=webp'

        const result = redactSensitive({
            imageUrls: [publicUrl, presignedUrl],
            nested: { download: presignedUrl, urls: [presignedUrl] },
            url: presignedUrl
        })

        expect(result).toEqual({
            imageUrls: [publicUrl, '[REDACTED]'],
            nested: { download: '[REDACTED]', urls: ['[REDACTED]'] },
            url: '[REDACTED]'
        })
    })

    it('DTO 클래스 인스턴스의 presigned URL도 열거 가능한 필드를 순회해 마스킹한다', () => {
        class MovieDto {
            id = 'movie-1'
            imageUrls: string[] = []
        }

        const movie = new MovieDto()
        movie.imageUrls = [
            'https://storage.example.com/movie.jpg?X-Amz-Credential=credential-secret&X-Amz-Signature=signature-secret'
        ]

        expect(redactSensitive(movie)).toEqual({ id: 'movie-1', imageUrls: ['[REDACTED]'] })
        expect(movie.imageUrls[0]).toContain('signature-secret')
    })

    it('S3 presigned POST 인증 필드는 대소문자와 관계없이 마스킹한다', () => {
        const result = redactSensitive({
            fields: {
                key: 'public/object-key',
                Policy: 'policy-secret',
                'X-Amz-Credential': 'credential-secret',
                'x-amz-signature': 'signature-secret',
                'X-AMZ-SECURITY-TOKEN': 'security-token-secret'
            }
        })

        expect(result).toEqual({
            fields: {
                key: 'public/object-key',
                Policy: '[REDACTED]',
                'X-Amz-Credential': '[REDACTED]',
                'x-amz-signature': '[REDACTED]',
                'X-AMZ-SECURITY-TOKEN': '[REDACTED]'
            }
        })
    })

    it('요청 본문이 BSON 식별자를 흉내 내도 민감 필드 순회를 건너뛰지 않는다', () => {
        const result = redactSensitive({ _bsontype: 'ObjectId', password: 'request-secret' })

        expect(result).toEqual({ _bsontype: 'ObjectId', password: '[REDACTED]' })
    })

    it('일반 URL의 경로·쿼리와 비민감 필드는 불필요하게 마스킹하지 않는다', () => {
        const input = {
            fields: { key: 'public/object-key', success_action_status: '201' },
            imageUrls: ['https://cdn.example.com/movie.jpg?width=640'],
            url: 'https://example.com/movies?page=2&sort=title'
        }

        expect(redactSensitive(input)).toEqual(input)
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

    it('prototype 체인으로 상속된 필드는 로그 복사본에 포함하지 않는다', () => {
        const proto = { password: 'should-leak' }
        const obj = Object.create(proto)
        obj.name = 'x'

        const result = redactSensitive(obj)

        expect(result).toEqual({ name: 'x' })
        expect(Object.hasOwn(result, 'password')).toBe(false)
    })
})
