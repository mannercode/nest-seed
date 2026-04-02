import { createHttpTestContext, HttpTestClient } from '@mannercode/testing'
import { Controller, Get, Injectable, Post, UseGuards } from '@nestjs/common'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { Reflector } from '@nestjs/core'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { defaultTo } from '../../utils'
import { JwtAuthGuard, LocalAuthGuard, OptionalJwtAuthGuard, Public } from '../guards'

const TEST_SECRET = 'test-secret'

@Injectable()
class TestLocalAuthGuard extends LocalAuthGuard {
    constructor() {
        super({
            passwordField: 'password',
            usernameField: 'email',
            validate: async (email: string, password: string) => {
                if (email === 'test@test.com' && password === 'pass') {
                    return { email, userId: 'user-1' }
                }
                return null
            }
        })
    }
}

@Injectable()
class TestJwtAuthGuardDefault extends JwtAuthGuard {
    constructor(jwtService: JwtService, reflector: Reflector) {
        super(jwtService, reflector, { secret: TEST_SECRET })
    }
}

@Injectable()
class TestJwtAuthGuard extends JwtAuthGuard {
    constructor(jwtService: JwtService, reflector: Reflector) {
        super(jwtService, reflector, { secret: TEST_SECRET })
    }

    protected isUsingLocalAuth(context: any): boolean {
        const handler = context.getHandler()
        const classRef = context.getClass()
        const guards =
            this.reflector.get<any[] | null>(GUARDS_METADATA, handler) ??
            this.reflector.get<any[] | null>(GUARDS_METADATA, classRef)

        return defaultTo(guards, []).some((g: any) => g === TestLocalAuthGuard)
    }
}

@Injectable()
class TestOptionalJwtAuthGuard extends OptionalJwtAuthGuard {
    constructor(jwtService: JwtService, reflector: Reflector) {
        super(jwtService, reflector, { secret: TEST_SECRET })
    }
}

@Controller('jwt')
@UseGuards(TestJwtAuthGuard)
class JwtTestController {
    @Get('protected')
    getProtected() {
        return { message: 'ok' }
    }

    @Public()
    @Get('public')
    getPublic() {
        return { message: 'public' }
    }

    @UseGuards(TestLocalAuthGuard)
    @Post('login')
    login() {
        return { message: 'logged in' }
    }
}

@Controller('default')
@UseGuards(TestJwtAuthGuardDefault)
class DefaultTestController {
    @UseGuards(TestLocalAuthGuard)
    @Post('login')
    login() {
        return { message: 'logged in' }
    }
}

@Controller('optional')
class OptionalTestController {
    @UseGuards(TestOptionalJwtAuthGuard)
    @Get('')
    getOptional() {
        return { message: 'optional' }
    }

    @Public()
    @UseGuards(TestOptionalJwtAuthGuard)
    @Get('public')
    getPublicOptional() {
        return { message: 'public optional' }
    }
}

@Injectable()
class TestLocalAuthGuardDefault extends LocalAuthGuard {
    constructor() {
        super({
            validate: async (username: string, password: string) => {
                if (username === 'admin' && password === 'pass') {
                    return { userId: 'user-1' }
                }
                return null
            }
        })
    }
}

@Controller('local')
class LocalTestController {
    @UseGuards(TestLocalAuthGuard)
    @Post('login')
    login() {
        return { message: 'logged in' }
    }

    @UseGuards(TestLocalAuthGuardDefault)
    @Post('login-default')
    loginDefault() {
        return { message: 'logged in' }
    }
}

export type GuardsFixture = {
    httpClient: HttpTestClient
    jwtService: JwtService
    teardown: () => Promise<void>
}

export async function createGuardsFixture(): Promise<GuardsFixture> {
    const testContext = await createHttpTestContext({
        controllers: [
            JwtTestController,
            DefaultTestController,
            OptionalTestController,
            LocalTestController
        ],
        imports: [JwtModule.register({ secret: TEST_SECRET })],
        providers: [
            TestJwtAuthGuard,
            TestJwtAuthGuardDefault,
            TestOptionalJwtAuthGuard,
            TestLocalAuthGuard,
            TestLocalAuthGuardDefault
        ]
    })

    const jwtService = testContext.module.get(JwtService)

    return { httpClient: testContext.httpClient, jwtService, teardown: testContext.close }
}
