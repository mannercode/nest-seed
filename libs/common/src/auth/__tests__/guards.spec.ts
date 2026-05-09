import { createGuardsFixture, type GuardsFixture } from './guards.fixture'

describe('Auth Guards', () => {
    let fix: GuardsFixture

    beforeEach(async () => {
        fix = await createGuardsFixture()
    })

    afterEach(async () => {
        await fix.teardown()
    })

    describe('JwtAuthGuard', () => {
        it('유효한 토큰으로 보호된 엔드포인트에 접근할 수 있다', async () => {
            const token = await fix.jwtService.signAsync({ userId: 'user-1' })

            await fix.httpClient
                .get('/jwt/protected')
                .headers({ Authorization: `Bearer ${token}` })
                .ok()
        })

        it('토큰 없이 접근하면 401을 반환한다', async () => {
            await fix.httpClient.get('/jwt/protected').unauthorized()
        })

        it('잘못된 토큰으로 접근하면 401을 반환한다', async () => {
            await fix.httpClient
                .get('/jwt/protected')
                .headers({ Authorization: 'Bearer invalid-token' })
                .unauthorized()
        })

        it('Bearer가 아닌 인증 타입이면 401을 반환한다', async () => {
            await fix.httpClient
                .get('/jwt/protected')
                .headers({ Authorization: 'Basic some-credentials' })
                .unauthorized()
        })

        it('LocalAuthGuard가 있는 라우트는 JWT 검증을 건너뛴다', async () => {
            await fix.httpClient
                .post('/jwt/login')
                .body({ email: 'test@test.com', password: 'pass' })
                .created()
        })

        it.todo('Authorization header 가 "Bearer" 만 있고 token 부분이 없으면 401 을 던진다')
    })

    describe('JwtAuthGuard (default isUsingLocalAuth)', () => {
        it('isUsingLocalAuth 미구현 시 LocalAuthGuard가 있어도 JWT 검증한다', async () => {
            await fix.httpClient
                .post('/default/login')
                .body({ email: 'test@test.com', password: 'pass' })
                .unauthorized()
        })
    })

    describe('Public decorator', () => {
        it('@Public() 데코레이터가 있는 엔드포인트는 토큰 없이 접근 가능하다', async () => {
            await fix.httpClient.get('/jwt/public').ok()
        })
    })

    describe('LocalAuthGuard', () => {
        it('올바른 자격 증명으로 로그인할 수 있다', async () => {
            await fix.httpClient
                .post('/local/login')
                .body({ email: 'test@test.com', password: 'pass' })
                .created()
        })

        it('잘못된 자격 증명이면 401을 반환한다', async () => {
            await fix.httpClient
                .post('/local/login')
                .body({ email: 'test@test.com', password: 'wrong' })
                .unauthorized()
        })

        it('자격 증명이 누락되면 401을 반환한다', async () => {
            await fix.httpClient.post('/local/login').body({}).unauthorized()
        })

        it('usernameField/passwordField 기본값(username/password)으로 로그인할 수 있다', async () => {
            await fix.httpClient
                .post('/local/login-default')
                .body({ username: 'admin', password: 'pass' })
                .created()
        })

        it.todo(
            'LocalAuthGuard 는 options.usernameField / passwordField 로 body 의 임의 필드명을 읽도록 설정할 수 있다'
        )
    })

    describe('OptionalJwtAuthGuard', () => {
        it('토큰 없이도 접근 가능하다', async () => {
            await fix.httpClient.get('/optional').ok()
        })

        it('유효한 토큰이 있으면 접근 가능하다', async () => {
            const token = await fix.jwtService.signAsync({ userId: 'user-1' })

            await fix.httpClient
                .get('/optional')
                .headers({ Authorization: `Bearer ${token}` })
                .ok()
        })

        it('잘못된 토큰이어도 접근 가능하다', async () => {
            await fix.httpClient
                .get('/optional')
                .headers({ Authorization: 'Bearer invalid-token' })
                .ok()
        })

        it('@Public() 라우트는 토큰 없이 접근 가능하다', async () => {
            await fix.httpClient.get('/optional/public').ok()
        })

        it('Bearer가 아닌 인증 타입이면 user를 null로 설정한다', async () => {
            await fix.httpClient
                .get('/optional')
                .headers({ Authorization: 'Basic some-credentials' })
                .ok()
        })
    })
})
