import { createHttpTestContext, HttpTestClient } from '@mannercode/testing'
import { Controller, Get, Injectable, UseGuards } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { AuthGuard, OptionalAuth, Public } from '../index.js'

const TEST_SECRET = 'test-secret'

@Injectable()
class BearerOnlyGuard extends AuthGuard {
    constructor(jwtService: JwtService, reflector: Reflector) {
        super(jwtService, reflector, {
            bearer: {
                secret: TEST_SECRET,
                validate: async (payload) => (payload as { userId?: string }).userId === 'user-1'
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
        controllers: [BearerController, OptionalController],
        imports: [JwtModule.register({ secret: TEST_SECRET })],
        providers: [BearerOnlyGuard, OptionalBearerGuard]
    })

    const jwtService = testContext.module.get(JwtService)

    return { httpClient: testContext.httpClient, jwtService, teardown: testContext.close }
}
