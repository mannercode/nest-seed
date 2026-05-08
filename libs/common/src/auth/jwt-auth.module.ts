import { DynamicModule, Inject, Module } from '@nestjs/common'
import { JwtModule, JwtService } from '@nestjs/jwt'
import Redis from 'ioredis'
import { getRedisConnectionToken } from '../redis'
import { defaultTo } from '../utils'
import { JwtAuthService } from './jwt-auth.service'
import { JwtAuthModuleOptions } from './jwt-auth.types'

const DEFAULT_USER_ID_FIELD = 'sub'

export function InjectJwtAuth(name?: string): ParameterDecorator {
    return Inject(JwtAuthService.getName(name))
}

@Module({})
export class JwtAuthModule {
    static register(options: JwtAuthModuleOptions): DynamicModule {
        const { inject, name, prefix, redisName, useFactory } = options

        const jwtAuthProvider = {
            inject: [JwtService, getRedisConnectionToken(redisName), ...defaultTo(inject, [])],
            provide: JwtAuthService.getName(name),
            useFactory: async (jwtService: JwtService, redis: Redis, ...args: any[]) => {
                const factoryOptions = await useFactory(...args)
                const { auth, onEvent, userIdField } = factoryOptions

                return new JwtAuthService(
                    jwtService,
                    auth,
                    redis,
                    `${prefix}:${defaultTo(name, 'default')}`,
                    defaultTo(userIdField, DEFAULT_USER_ID_FIELD),
                    onEvent
                )
            }
        }

        return {
            exports: [jwtAuthProvider],
            imports: [JwtModule.register({})],
            module: JwtAuthModule,
            providers: [jwtAuthProvider]
        }
    }
}
