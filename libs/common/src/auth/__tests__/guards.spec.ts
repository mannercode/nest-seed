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
        it('유효한 토큰으로 접근할 수 있다', async () => {
            const token = await fix.jwtService.signAsync({ userId: 'user-1' })

            await fix.httpClient
                .get('/bearer/protected')
                .headers({ Authorization: `Bearer ${token}` })
                .ok()
        })

        it('서명은 유효해도 현재 계정 검증에 실패하면 401을 반환한다', async () => {
            const token = await fix.jwtService.signAsync({ userId: 'revoked-user' })

            await fix.httpClient
                .get('/bearer/protected')
                .headers({ Authorization: `Bearer ${token}` })
                .unauthorized()
        })

        it('토큰 없이 접근하면 401을 반환한다', async () => {
            await fix.httpClient.get('/bearer/protected').unauthorized()
        })

        it('형식이 깨진 토큰으로 접근하면 401을 반환한다', async () => {
            await fix.httpClient
                .get('/bearer/protected')
                .headers({ Authorization: 'Bearer invalid-token' })
                .unauthorized()
        })

        it('만료된 토큰으로 접근하면 401을 반환한다', async () => {
            const expired = await fix.jwtService.signAsync(
                { userId: 'user-1' },
                { expiresIn: '-1s' }
            )

            await fix.httpClient
                .get('/bearer/protected')
                .headers({ Authorization: `Bearer ${expired}` })
                .unauthorized()
        })

        it('Basic 스킴으로 접근하면 401을 반환한다', async () => {
            await fix.httpClient
                .get('/bearer/protected')
                .headers({ Authorization: 'Basic credentials' })
                .unauthorized()
        })

        it('인증 스킴은 대소문자를 구분하지 않는다', async () => {
            const token = await fix.jwtService.signAsync({ userId: 'user-1' })

            await fix.httpClient
                .get('/bearer/protected')
                .headers({ Authorization: `bearer ${token}` })
                .ok()
        })

        it('스킴 뒤 공백/토큰이 비어 있으면 401을 반환한다', async () => {
            // HTTP 헤더의 trailing whitespace는 Node http 파서가 trim해서 가드 입장에서는
            // "Bearer" 한 단어로 보인다(공백 분리 실패 → 즉시 401).
            await fix.httpClient
                .get('/bearer/protected')
                .headers({ Authorization: 'Bearer ' })
                .unauthorized()
        })

        it('@Public이 붙은 엔드포인트는 토큰 없이 접근할 수 있다', async () => {
            await fix.httpClient.get('/bearer/public').ok()
        })

        it('@OptionalAuth가 붙은 라우트는 헤더 없이 접근할 수 있다', async () => {
            await fix.httpClient.get('/bearer/optional-route').ok()
        })

        it('@OptionalAuth가 붙은 라우트도 잘못된 토큰이면 401을 반환한다', async () => {
            const expired = await fix.jwtService.signAsync(
                { userId: 'user-1' },
                { expiresIn: '-1s' }
            )

            await fix.httpClient
                .get('/bearer/optional-route')
                .headers({ Authorization: `Bearer ${expired}` })
                .unauthorized()
        })
    })

    describe('Optional', () => {
        it('헤더가 없어도 접근할 수 있다', async () => {
            await fix.httpClient.get('/optional').ok()
        })

        it('유효한 Bearer 토큰이면 접근할 수 있다', async () => {
            const token = await fix.jwtService.signAsync({ userId: 'user-1' })

            await fix.httpClient
                .get('/optional')
                .headers({ Authorization: `Bearer ${token}` })
                .ok()
        })

        it('형식이 깨진 토큰이면 401을 반환한다', async () => {
            await fix.httpClient
                .get('/optional')
                .headers({ Authorization: 'Bearer invalid-token' })
                .unauthorized()
        })

        it('만료된 토큰이면 401을 반환한다', async () => {
            const expired = await fix.jwtService.signAsync(
                { userId: 'user-1' },
                { expiresIn: '-1s' }
            )

            await fix.httpClient
                .get('/optional')
                .headers({ Authorization: `Bearer ${expired}` })
                .unauthorized()
        })

        it('지원하지 않는 스킴(Basic)이면 401을 반환한다', async () => {
            await fix.httpClient
                .get('/optional')
                .headers({ Authorization: 'Basic credentials' })
                .unauthorized()
        })

        it('@Public이 붙은 라우트는 헤더 없이 접근할 수 있다', async () => {
            await fix.httpClient.get('/optional/public').ok()
        })
    })
})
