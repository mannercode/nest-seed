import { createGuardsFixture, GuardsFixture } from './guards.fixture'

describe('Auth Guards', () => {
    let fix: GuardsFixture

    beforeEach(async () => {
        fix = await createGuardsFixture()
    })

    afterEach(async () => {
        await fix.teardown()
    })

    describe('JwtAuthGuard', () => {
        // 유효한 토큰으로 보호된 엔드포인트에 접근할 수 있다
        it('allows access with valid token', async () => {
            const token = await fix.jwtService.signAsync({ userId: 'user-1' })

            await fix.httpClient
                .get('/jwt/protected')
                .headers({ Authorization: `Bearer ${token}` })
                .ok()
        })

        // 토큰 없이 접근하면 401을 반환한다
        it('returns 401 without token', async () => {
            await fix.httpClient.get('/jwt/protected').unauthorized()
        })

        // 잘못된 토큰으로 접근하면 401을 반환한다
        it('returns 401 with invalid token', async () => {
            await fix.httpClient
                .get('/jwt/protected')
                .headers({ Authorization: 'Bearer invalid-token' })
                .unauthorized()
        })

        // Bearer가 아닌 인증 타입이면 401을 반환한다
        it('returns 401 with non-Bearer auth type', async () => {
            await fix.httpClient
                .get('/jwt/protected')
                .headers({ Authorization: 'Basic some-credentials' })
                .unauthorized()
        })

        // LocalAuthGuard가 있는 라우트는 JWT 검증을 건너뛴다
        it('skips JWT validation when LocalAuthGuard is present', async () => {
            await fix.httpClient
                .post('/jwt/login')
                .body({ email: 'test@test.com', password: 'pass' })
                .created()
        })
    })

    describe('JwtAuthGuard (default isUsingLocalAuth)', () => {
        // isUsingLocalAuth 미구현 시 LocalAuthGuard가 있어도 JWT 검증한다
        it('does not skip JWT when isUsingLocalAuth is not overridden', async () => {
            await fix.httpClient
                .post('/default/login')
                .body({ email: 'test@test.com', password: 'pass' })
                .unauthorized()
        })
    })

    describe('Public decorator', () => {
        // @Public() 데코레이터가 있는 엔드포인트는 토큰 없이 접근 가능하다
        it('allows access without token on public routes', async () => {
            await fix.httpClient.get('/jwt/public').ok()
        })
    })

    describe('LocalAuthGuard', () => {
        // 올바른 자격 증명으로 로그인할 수 있다
        it('allows login with valid credentials', async () => {
            await fix.httpClient
                .post('/local/login')
                .body({ email: 'test@test.com', password: 'pass' })
                .created()
        })

        // 잘못된 자격 증명이면 401을 반환한다
        it('returns 401 with invalid credentials', async () => {
            await fix.httpClient
                .post('/local/login')
                .body({ email: 'test@test.com', password: 'wrong' })
                .unauthorized()
        })

        // 자격 증명이 누락되면 401을 반환한다
        it('returns 401 when credentials are missing', async () => {
            await fix.httpClient.post('/local/login').body({}).unauthorized()
        })

        // usernameField/passwordField 기본값(username/password)으로 로그인할 수 있다
        it('uses default field names when not specified', async () => {
            await fix.httpClient
                .post('/local/login-default')
                .body({ username: 'admin', password: 'pass' })
                .created()
        })
    })

    describe('OptionalJwtAuthGuard', () => {
        // 토큰 없이도 접근 가능하다
        it('allows access without token', async () => {
            await fix.httpClient.get('/optional').ok()
        })

        // 유효한 토큰이 있으면 접근 가능하다
        it('allows access with valid token', async () => {
            const token = await fix.jwtService.signAsync({ userId: 'user-1' })

            await fix.httpClient
                .get('/optional')
                .headers({ Authorization: `Bearer ${token}` })
                .ok()
        })

        // 잘못된 토큰이어도 접근 가능하다
        it('allows access with invalid token', async () => {
            await fix.httpClient
                .get('/optional')
                .headers({ Authorization: 'Bearer invalid-token' })
                .ok()
        })

        // @Public() 라우트는 토큰 없이 접근 가능하다
        it('allows access on public route without token', async () => {
            await fix.httpClient.get('/optional/public').ok()
        })

        // Bearer가 아닌 인증 타입이면 user를 null로 설정한다
        it('sets user to null with non-Bearer auth type', async () => {
            await fix.httpClient
                .get('/optional')
                .headers({ Authorization: 'Basic some-credentials' })
                .ok()
        })
    })
})
