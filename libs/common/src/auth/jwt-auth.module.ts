import { DynamicModule, Inject, Module } from '@nestjs/common'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { Redis } from 'ioredis'
import { getRedisConnectionToken } from '../redis/index.js'
import { defaultTo } from '../utils/index.js'
import { JwtAuthService } from './jwt-auth.service.js'
import { JwtAuthModuleOptions } from './jwt-auth.types.js'

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
                const { auth } = await useFactory(...args)
                const resolvedPrefix = typeof prefix === 'function' ? await prefix(...args) : prefix

                return new JwtAuthService(
                    jwtService,
                    auth,
                    redis,
                    `${resolvedPrefix}:${defaultTo(name, 'default')}`
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
