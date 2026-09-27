import { PasswordHasher } from '../index.js'
import { createGuardsFixture, type GuardsFixture } from './guards.fixture.js'

describe('AuthGuard', () => {
    let fix: GuardsFixture

    beforeEach(async () => {
        fix = await createGuardsFixture()
    })

    afterEach(async () => {
        await fix.teardown()
    })

    describe('Bearer 전용', () => {
        describe('유효한 Bearer 토큰이 있으면', () => {
            let request: typeof fix.httpClient
            beforeEach(async () => {
                const token = await fix.jwtService.signAsync({ userId: 'user-1' })
                request = fix.httpClient
                    .get('/bearer/protected')
                    .headers({ Authorization: `Bearer ${token}` })
            })
            it('보호 경로에 요청하면 200을 반환한다', async () => {
                await request.ok()
            })
        })

        describe('토큰 서명은 유효하지만 사용자 ID가 숫자이면', () => {
            let request: typeof fix.httpClient
            beforeEach(async () => {
                const token = await fix.jwtService.signAsync({ userId: 123 })
                request = fix.httpClient
                    .get('/bearer/protected')
                    .headers({ Authorization: `Bearer ${token}` })
            })
            it('보호 경로에 요청하면 401을 반환한다', async () => {
                await request.unauthorized()
            })
        })

        describe('Authorization 헤더가 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/bearer/protected')
            })
            it('보호 경로에 요청하면 401을 반환한다', async () => {
                await request.unauthorized()
            })
        })

        describe('토큰 문자열이 깨져 있으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .get('/bearer/protected')
                    .headers({ Authorization: 'Bearer invalid-token' })
            })
            it('보호 경로에 요청하면 401을 반환한다', async () => {
                await request.unauthorized()
            })
        })

        describe('토큰이 만료되었으면', () => {
            let request: typeof fix.httpClient
            beforeEach(async () => {
                const expired = await fix.jwtService.signAsync(
                    { userId: 'user-1' },
                    { expiresIn: '-1s' }
                )
                request = fix.httpClient
                    .get('/bearer/protected')
                    .headers({ Authorization: `Bearer ${expired}` })
            })
            it('보호 경로에 요청하면 401을 반환한다', async () => {
                await request.unauthorized()
            })
        })

        describe('Authorization 헤더의 인증 방식이 Basic이면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .get('/bearer/protected')
                    .headers({ Authorization: 'Basic credentials' })
            })
            it('보호 경로에 요청하면 401을 반환한다', async () => {
                await request.unauthorized()
            })
        })

        describe('Authorization 헤더의 bearer가 소문자이면', () => {
            let request: typeof fix.httpClient
            beforeEach(async () => {
                const token = await fix.jwtService.signAsync({ userId: 'user-1' })
                request = fix.httpClient
                    .get('/bearer/protected')
                    .headers({ Authorization: `bearer ${token}` })
            })
            it('보호 경로에 요청하면 200을 반환한다', async () => {
                await request.ok()
            })
        })

        describe('Authorization 헤더의 Bearer 뒤에 토큰이 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .get('/bearer/protected')
                    .headers({ Authorization: 'Bearer ' })
            })
            it('보호 경로에 요청하면 401을 반환한다', async () => {
                // Node의 HTTP 파서가 헤더 끝 공백을 제거하므로 가드에는 "Bearer"만 전달된다.
                await request.unauthorized()
            })
        })

        describe('@Public 경로에 보낼 요청에 인증 정보가 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/bearer/public')
            })
            it('요청하면 200을 반환한다', async () => {
                await request.ok()
            })
        })

        describe('@OptionalAuth 경로에 보낼 요청에 인증 정보가 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/bearer/optional-route')
            })
            it('요청하면 200을 반환한다', async () => {
                await request.ok()
            })
        })

        describe('@OptionalAuth 경로에 보낼 토큰이 만료되었으면', () => {
            let request: typeof fix.httpClient
            beforeEach(async () => {
                const expired = await fix.jwtService.signAsync(
                    { userId: 'user-1' },
                    { expiresIn: '-1s' }
                )
                request = fix.httpClient
                    .get('/bearer/optional-route')
                    .headers({ Authorization: `Bearer ${expired}` })
            })
            it('요청하면 401을 반환한다', async () => {
                await request.unauthorized()
            })
        })
    })

    describe('Optional', () => {
        describe('Authorization 헤더가 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/optional')
            })
            it('요청하면 200을 반환한다', async () => {
                await request.ok()
            })
        })

        describe('유효한 Bearer 토큰이 있으면', () => {
            let request: typeof fix.httpClient
            beforeEach(async () => {
                const token = await fix.jwtService.signAsync({ userId: 'user-1' })
                request = fix.httpClient
                    .get('/optional')
                    .headers({ Authorization: `Bearer ${token}` })
            })
            it('요청하면 200을 반환한다', async () => {
                await request.ok()
            })
        })

        describe('토큰 문자열이 깨져 있으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .get('/optional')
                    .headers({ Authorization: 'Bearer invalid-token' })
            })
            it('요청하면 401을 반환한다', async () => {
                await request.unauthorized()
            })
        })

        describe('토큰이 만료되었으면', () => {
            let request: typeof fix.httpClient
            beforeEach(async () => {
                const expired = await fix.jwtService.signAsync(
                    { userId: 'user-1' },
                    { expiresIn: '-1s' }
                )
                request = fix.httpClient
                    .get('/optional')
                    .headers({ Authorization: `Bearer ${expired}` })
            })
            it('요청하면 401을 반환한다', async () => {
                await request.unauthorized()
            })
        })

        describe('Authorization 헤더의 인증 방식이 Basic이면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .get('/optional')
                    .headers({ Authorization: 'Basic credentials' })
            })
            it('요청하면 401을 반환한다', async () => {
                await request.unauthorized()
            })
        })

        describe('@Public 경로에 보낼 요청에 인증 정보가 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/optional/public')
            })
            it('요청하면 200을 반환한다', async () => {
                await request.ok()
            })
        })
    })
})

describe('PasswordHasher', () => {
    it('해시를 만든 비밀번호만 검증에 성공한다', async () => {
        const hashed = await PasswordHasher.hash('password')
        expect(hashed).toMatch(/^\$2[aby]\$10\$/)
        expect(await PasswordHasher.verify('password', hashed)).toBe(true)
        expect(await PasswordHasher.verify('wrong', hashed)).toBe(false)
    })
    describe('계정에 저장된 비밀번호 해시가 없으면', () => {
        let hash: undefined
        beforeEach(() => {
            hash = undefined
        })
        it('비밀번호를 검증하면 일반·dummy 비밀번호 모두 실패한다', async () => {
            expect(await PasswordHasher.verify('wrong', hash)).toBe(false)
            expect(await PasswordHasher.verify('timing-equalization-only', hash)).toBe(false)
        })
    })
})
