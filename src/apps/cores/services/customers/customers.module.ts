import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { PassportModule } from '@nestjs/passport'
import { generateShortId, JwtAuthModule, stringToMillisecs } from 'common'
import { CoresConfigService, isTest, MongooseConfig, RedisConfig } from '../../config'
import { CustomersController } from './customers.controller'
import { CustomersRepository } from './customers.repository'
import { CustomersService } from './customers.service'
import { Customer, CustomerSchema } from './models'

@Module({
    imports: [
        MongooseModule.forFeature(
            [{ name: Customer.name, schema: CustomerSchema }],
            MongooseConfig.connName
        ),
        PassportModule,
        JwtAuthModule.register({
            name: 'customer',
            redisName: RedisConfig.connName,
            useFactory: ({ auth }: CoresConfigService) => ({
                prefix: isTest() ? `jwtauth:${generateShortId()}` : 'jwtauth',
                auth: {
                    accessSecret: auth.accessSecret,
                    accessTokenTtlMs: stringToMillisecs(auth.accessTokenExpiration),
                    refreshSecret: auth.refreshSecret,
                    refreshTokenTtlMs: stringToMillisecs(auth.refreshTokenExpiration)
                }
            }),
            inject: [CoresConfigService]
        })
    ],
    providers: [CustomersService, CustomersRepository],
    controllers: [CustomersController]
})
export class CustomersModule {}
