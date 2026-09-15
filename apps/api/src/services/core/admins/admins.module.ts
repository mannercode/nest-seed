import { JwtAuthModule, TimeUtil } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { AppConfigService, REDIS_CONNECTION_NAME } from '#config'
import { AdminsRepository } from './admins.repository.js'
import { AdminsService } from './admins.service.js'
import { ADMIN_JWT_AUTH_NAME, AdminAuthenticationService } from './internal/index.js'

@Module({
    exports: [AdminsService],
    imports: [
        JwtAuthModule.register({
            inject: [AppConfigService],
            name: ADMIN_JWT_AUTH_NAME,
            prefix: (config: AppConfigService) => `jwtauth:${config.projectId}`,
            redisName: REDIS_CONNECTION_NAME,
            useFactory: ({ adminAuth }: AppConfigService) => ({
                auth: {
                    accessSecret: adminAuth.accessSecret,
                    accessTokenTtlMs: TimeUtil.toMs(adminAuth.accessTokenExpiration),
                    audience: adminAuth.audience,
                    issuer: adminAuth.issuer,
                    refreshSecret: adminAuth.refreshSecret,
                    refreshTokenTtlMs: TimeUtil.toMs(adminAuth.refreshTokenExpiration)
                }
            })
        })
    ],
    providers: [AdminsService, AdminAuthenticationService, AdminsRepository]
})
export class AdminsModule {}
