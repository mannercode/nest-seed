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

        it('잘못된 토큰으로 접근하면 500을 반환한다', async () => {
            await fix.httpClient
                .get('/jwt/protected')
                .headers({ Authorization: 'Bearer invalid-token' })
                .internalServerError()
        })

        it('Bearer 방식이 아니면 401을 반환한다', async () => {
            await fix.httpClient
                .get('/jwt/protected')
                .headers({ Authorization: 'Basic some-credentials' })
                .unauthorized()
        })

        it('LocalAuthGuard 라우트는 JWT 검증을 건너뛴다', async () => {
            await fix.httpClient
                .post('/jwt/login')
                .body({ email: 'test@test.com', password: 'pass' })
                .created()
        })

        it('Authorization 헤더가 "Bearer"만 있고 토큰이 없으면 401을 반환한다', async () => {
            await fix.httpClient
                .get('/jwt/protected')
                .headers({ Authorization: 'Bearer ' })
                .unauthorized()
        })
    })

    describe('isUsingLocalAuth 기본 구현', () => {
        it('재정의하지 않은 가드는 JWT를 검증한다', async () => {
            await fix.httpClient
                .post('/default/login')
                .body({ email: 'test@test.com', password: 'pass' })
                .unauthorized()
        })
    })

    describe('@Public 데코레이터', () => {
        it('@Public이 붙은 엔드포인트는 토큰 없이 접근할 수 있다', async () => {
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

        it('기본 로그인 필드 이름은 username과 password이다', async () => {
            await fix.httpClient
                .post('/local/login-default')
                .body({ username: 'admin', password: 'pass' })
                .created()
        })

        it('옵션으로 로그인 필드 이름을 바꿀 수 있다', async () => {
            await fix.httpClient
                .post('/local/login-custom')
                .body({ login: 'custom', pwd: 'secret' })
                .created()
        })
    })

    describe('OptionalJwtAuthGuard', () => {
        it('토큰이 없어도 접근할 수 있다', async () => {
            await fix.httpClient.get('/optional').ok()
        })

        it('유효한 토큰이 있으면 접근할 수 있다', async () => {
            const token = await fix.jwtService.signAsync({ userId: 'user-1' })

            await fix.httpClient
                .get('/optional')
                .headers({ Authorization: `Bearer ${token}` })
                .ok()
        })

        it('잘못된 토큰이어도 접근할 수 있다', async () => {
            await fix.httpClient
                .get('/optional')
                .headers({ Authorization: 'Bearer invalid-token' })
                .ok()
        })

        it('@Public이 붙은 라우트는 토큰 없이 접근할 수 있다', async () => {
            await fix.httpClient.get('/optional/public').ok()
        })

        it('Bearer 방식이 아니면 user를 null로 둔다', async () => {
            await fix.httpClient
                .get('/optional')
                .headers({ Authorization: 'Basic some-credentials' })
                .ok()
        })
    })
})
