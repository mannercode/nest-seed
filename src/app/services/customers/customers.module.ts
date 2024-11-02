import { RedisModule } from '@nestjs-modules/ioredis'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { PassportModule } from '@nestjs/passport'
import { AUTH_CONFIG, RedisService, generateUUID, JwtAuthService } from 'common'
import { AppConfigService, isEnv } from 'config'
import { CustomersRepository } from './customers.repository'
import { CustomersService } from './customers.service'
import { Customer, CustomerSchema } from './models'

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Customer.name, schema: CustomerSchema }]),
        PassportModule,
        RedisModule.forRootAsync({
            useFactory: async (configService: AppConfigService) => {
                const { host, port } = configService.customerAuth

                return { type: 'single', url: `redis://${host}:${port}` }
            },
            inject: [AppConfigService]
        })
    ],
    providers: [
        CustomersService,
        CustomersRepository,
        JwtAuthService,
        {
            provide: AUTH_CONFIG,
            useFactory: (config: AppConfigService) => config.auth,
            inject: [AppConfigService]
        },
        RedisService,
        {
            provide: 'PREFIX',
            useFactory: () => (isEnv('test') ? 'auth:' + generateUUID() : 'CustomerAuth')
        }
    ],
    exports: [CustomersService]
})
export class CustomersModule {}
