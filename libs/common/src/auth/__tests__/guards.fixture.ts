import { createHttpTestContext, HttpTestClient } from '@mannercode/testing'
import { Controller, Get, Injectable, UseGuards } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { AuthGuard } from '../auth.guard'
import { OptionalAuth } from '../optional-auth.decorator'
import { Public } from '../public.decorator'

const TEST_SECRET = 'test-secret'

@Injectable()
class BearerOnlyGuard extends AuthGuard {
    constructor(jwtService: JwtService, reflector: Reflector) {
        super(jwtService, reflector, { bearer: { secret: TEST_SECRET } })
    }
}

@Injectable()
class BasicOnlyGuard extends AuthGuard {
    constructor(jwtService: JwtService, reflector: Reflector) {
        super(jwtService, reflector, {
            basic: {
                validate: async (username, password) => {
                    if (username === 'admin' && password === 'pass') {
                        return { kind: 'admin', name: username }
                    }
                    return null
                }
            }
        })
    }
}

@Injectable()
class BearerAndBasicGuard extends AuthGuard {
    constructor(jwtService: JwtService, reflector: Reflector) {
        super(jwtService, reflector, {
            bearer: { secret: TEST_SECRET },
            basic: {
                validate: async (username, password) =>
                    username === 'root' && password === 'pass' ? { kind: 'root' } : null
            }
        })
    }
}

@Injectable()
class OptionalBearerGuard extends AuthGuard {
    constructor(jwtService: JwtService, reflector: Reflector) {
        super(jwtService, reflector, { bearer: { secret: TEST_SECRET }, optional: true })
    }
}

@Controller('bearer')
@UseGuards(BearerOnlyGuard)
class BearerController {
    @Get('protected')
    getProtected() {
        return { message: 'ok' }
    }

    @Public()
    @Get('public')
    getPublic() {
        return { message: 'public' }
    }

    @OptionalAuth()
    @Get('optional-route')
    getOptionalRoute() {
        return { message: 'optional route' }
    }
}

@Controller('basic')
@UseGuards(BasicOnlyGuard)
class BasicController {
    @Get('protected')
    getProtected() {
        return { message: 'ok' }
    }
}

@Controller('mixed')
@UseGuards(BearerAndBasicGuard)
class MixedController {
    @Get('protected')
    getProtected() {
        return { message: 'ok' }
    }
}

@Controller('optional')
@UseGuards(OptionalBearerGuard)
class OptionalController {
    @Get('')
    getOptional() {
        return { message: 'optional' }
    }

    @Public()
    @Get('public')
    getPublicOptional() {
        return { message: 'public optional' }
    }
}

export type GuardsFixture = {
    httpClient: HttpTestClient
    jwtService: JwtService
    teardown: () => Promise<void>
}

export async function createGuardsFixture(): Promise<GuardsFixture> {
    const testContext = await createHttpTestContext({
        controllers: [BearerController, BasicController, MixedController, OptionalController],
        imports: [JwtModule.register({ secret: TEST_SECRET })],
        providers: [BearerOnlyGuard, BasicOnlyGuard, BearerAndBasicGuard, OptionalBearerGuard]
    })

    const jwtService = testContext.module.get(JwtService)

    return { httpClient: testContext.httpClient, jwtService, teardown: testContext.close }
}

export function basicHeader(username: string, password: string) {
    return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
}
