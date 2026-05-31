import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { AuthGuard } from '../auth.guard'
import { basicHeader, createGuardsFixture, type GuardsFixture } from './guards.fixture'

describe('AuthGuard', () => {
    let fix: GuardsFixture

    beforeEach(async () => {
        fix = await createGuardsFixture()
    })

    afterEach(async () => {
        await fix.teardown()
    })

    describe('생성자 검증', () => {
        // 잘못 설정된 가드를 런타임까지 끌고 가지 않도록 부팅 시 즉시 거절한다.
        it('bearer/basic 둘 다 없으면 즉시 에러를 던진다', () => {
            class EmptyGuard extends AuthGuard {
                constructor() {
                    super(new JwtService({}), new Reflector(), {})
                }
            }
            expect(() => new EmptyGuard()).toThrow(/at least one of `bearer` or `basic`/)
        })
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

        it('Basic 스킴으로 접근하면 401을 반환한다(basic 미설정)', async () => {
            await fix.httpClient
                .get('/bearer/protected')
                .headers({ Authorization: basicHeader('admin', 'pass') })
                .unauthorized()
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

        it('스킴 뒤 공백/값이 비어 있으면 401을 반환한다', async () => {
            // trailing whitespace는 Node http 파서가 trim한다("Basic" → 공백 분리 실패).
            await fix.httpClient
                .get('/basic/protected')
                .headers({ Authorization: 'Basic ' })
                .unauthorized()
        })

        it('비밀번호에 콜론이 포함되어도 첫 ":"만 기준으로 분리한다', async () => {
            // 픽스처에 'colon'/'pa:ss:word' 계정을 두고 .ok()를 기대한다.
            // 콜론마다 분리하면 password가 'pa'나 'ss:word' 등으로 바뀌어 검증이 실패하므로,
            // 200이 떨어진다는 것은 첫 ':'만 기준으로 끊었다는 증거다.
            await fix.httpClient
                .get('/basic/protected')
                .headers({ Authorization: basicHeader('colon', 'pa:ss:word') })
                .ok()
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
                .headers({ Authorization: basicHeader('admin', 'pass') })
                .unauthorized()
        })

        it('@Public이 붙은 라우트는 헤더 없이 접근할 수 있다', async () => {
            await fix.httpClient.get('/optional/public').ok()
        })
    })
})
