import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { PassportModule } from '@nestjs/passport'
import { JwtAuthModule, Time } from 'common'
import { AppConfigService, getProjectId, MongooseConfigModule, RedisConfigModule } from 'shared'
import { CustomersController } from './customers.controller'
import { CustomersRepository } from './customers.repository'
import { CustomersService } from './customers.service'
import { Customer, CustomerSchema } from './models'
import { CustomerAuthenticationService } from './services'

@Module({
    controllers: [CustomersController],
    imports: [
        MongooseModule.forFeature(
            [{ name: Customer.name, schema: CustomerSchema }],
            MongooseConfigModule.connectionName
        ),
        PassportModule,
        JwtAuthModule.register({
            inject: [AppConfigService],
            prefix: `jwtauth:${getProjectId()}`,
            redisName: RedisConfigModule.connectionName,
            useFactory: ({ auth }: AppConfigService) => ({
                auth: {
                    accessSecret: auth.accessSecret,
                    accessTokenTtlMs: Time.toMs(auth.accessTokenExpiration),
                    refreshSecret: auth.refreshSecret,
                    refreshTokenTtlMs: Time.toMs(auth.refreshTokenExpiration)
                }
            })
        })
    ],
    providers: [CustomersService, CustomerAuthenticationService, CustomersRepository]
})
export class CustomersModule {}
