import { AppLoggerService, JwtAuthModule, SecurityEvent, TimeUtil } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AppConfigService, MONGO_CONNECTION_NAME, REDIS_CONNECTION_NAME } from '#config'
import { AdminsRepository } from './admins.repository.js'
import { AdminsService } from './admins.service.js'
import { ADMIN_JWT_AUTH_NAME, AdminAuthenticationService } from './internal/index.js'
import { Admin, AdminSchema } from './models/index.js'

@Module({
    exports: [AdminsService],
    imports: [
        MongooseModule.forFeature(
            [{ name: Admin.name, schema: AdminSchema }],
            MONGO_CONNECTION_NAME
        ),
        JwtAuthModule.register({
            inject: [AppConfigService, AppLoggerService],
            name: ADMIN_JWT_AUTH_NAME,
            prefix: (config: AppConfigService) => `jwtauth:${config.projectId}`,
            redisName: REDIS_CONNECTION_NAME,
            useFactory: ({ adminAuth }: AppConfigService, logger: AppLoggerService) => ({
                auth: {
                    accessSecret: adminAuth.accessSecret,
                    accessTokenTtlMs: TimeUtil.toMs(adminAuth.accessTokenExpiration),
                    audience: adminAuth.audience,
                    issuer: adminAuth.issuer,
                    refreshSecret: adminAuth.refreshSecret,
                    refreshTokenTtlMs: TimeUtil.toMs(adminAuth.refreshTokenExpiration)
                },
                onEvent: (event: SecurityEvent) => {
                    const message = `security_event:${event.type}`
                    if (event.type === 'token.reuse_detected') logger.error(message, event)
                    else if (event.type === 'verify.failed') logger.warn(message, event)
                    else logger.log(message, event)
                }
            })
        })
    ],
    providers: [AdminsService, AdminAuthenticationService, AdminsRepository]
})
export class AdminsModule {}
