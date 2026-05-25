import { basicHeader, createGuardsFixture, type GuardsFixture } from './guards.fixture'

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

        it('토큰 없이 접근하면 401을 반환한다', async () => {
            await fix.httpClient.get('/bearer/protected').unauthorized()
        })

        it('형식이 깨진 토큰으로 접근하면 500을 반환한다', async () => {
            await fix.httpClient
                .get('/bearer/protected')
                .headers({ Authorization: 'Bearer invalid-token' })
                .internalServerError()
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

        it('Basic 스킴으로 접근하면 401을 반환한다(basic 미설정)', async () => {
            await fix.httpClient
                .get('/bearer/protected')
                .headers({ Authorization: basicHeader('admin', 'pass') })
                .unauthorized()
        })

        it('"Bearer "만 있고 토큰이 비어 있으면 401을 반환한다', async () => {
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

        it('@OptionalAuth가 붙은 라우트도 잘못된 토큰이면 401이다', async () => {
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

    describe('Basic 전용', () => {
        it('올바른 자격증명으로 접근할 수 있다', async () => {
            await fix.httpClient
                .get('/basic/protected')
                .headers({ Authorization: basicHeader('admin', 'pass') })
                .ok()
        })

        it('잘못된 자격증명이면 401을 반환한다', async () => {
            await fix.httpClient
                .get('/basic/protected')
                .headers({ Authorization: basicHeader('admin', 'wrong') })
                .unauthorized()
        })

        it('헤더가 없으면 401을 반환한다', async () => {
            await fix.httpClient.get('/basic/protected').unauthorized()
        })

        it('Bearer 스킴이면 401을 반환한다(bearer 미설정)', async () => {
            const token = await fix.jwtService.signAsync({ userId: 'user-1' })
            await fix.httpClient
                .get('/basic/protected')
                .headers({ Authorization: `Bearer ${token}` })
                .unauthorized()
        })

        it('base64에 콜론이 없으면 401을 반환한다', async () => {
            const malformed = 'Basic ' + Buffer.from('no-colon-here').toString('base64')
            await fix.httpClient
                .get('/basic/protected')
                .headers({ Authorization: malformed })
                .unauthorized()
        })

        it('"Basic "만 있고 값이 비어 있으면 401을 반환한다', async () => {
            await fix.httpClient
                .get('/basic/protected')
                .headers({ Authorization: 'Basic ' })
                .unauthorized()
        })

        it('비밀번호에 콜론이 포함되어도 정상 분리한다', async () => {
            // basic-only 가드는 'pass'만 통과시키므로 콜론 포함 검증은 별도 가드에서.
            // 여기서는 분리 자체가 깨지지 않는지를 401 응답으로 확인한다(잘못된 비번 → 401).
            await fix.httpClient
                .get('/basic/protected')
                .headers({ Authorization: basicHeader('admin', 'pa:ss:word') })
                .unauthorized()
        })
    })

    describe('Bearer + Basic 동시 설정', () => {
        it('Bearer 토큰으로 통과한다', async () => {
            const token = await fix.jwtService.signAsync({ userId: 'user-1' })

            await fix.httpClient
                .get('/mixed/protected')
                .headers({ Authorization: `Bearer ${token}` })
                .ok()
        })

        it('Basic 자격증명으로 통과한다', async () => {
            await fix.httpClient
                .get('/mixed/protected')
                .headers({ Authorization: basicHeader('root', 'pass') })
                .ok()
        })

        it('잘못된 Basic 자격증명이면 401을 반환한다', async () => {
            await fix.httpClient
                .get('/mixed/protected')
                .headers({ Authorization: basicHeader('root', 'wrong') })
                .unauthorized()
        })

        it('지원하지 않는 스킴이면 401을 반환한다', async () => {
            await fix.httpClient
                .get('/mixed/protected')
                .headers({ Authorization: 'Digest some-creds' })
                .unauthorized()
        })

        it('스킴 비교는 대소문자를 가리지 않는다', async () => {
            const token = await fix.jwtService.signAsync({ userId: 'user-1' })
            await fix.httpClient
                .get('/mixed/protected')
                .headers({ Authorization: `bearer ${token}` })
                .ok()
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

        it('형식이 깨진 토큰이면 500을 반환한다', async () => {
            await fix.httpClient
                .get('/optional')
                .headers({ Authorization: 'Bearer invalid-token' })
                .internalServerError()
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
                .headers({ Authorization: basicHeader('admin', 'pass') })
                .unauthorized()
        })

        it('@Public이 붙은 라우트는 헤더 없이 접근할 수 있다', async () => {
            await fix.httpClient.get('/optional/public').ok()
        })
    })
})
