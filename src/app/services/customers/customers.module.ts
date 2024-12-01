import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { PassportModule } from '@nestjs/passport'
import { CacheModule, CacheService, generateShortId, JwtAuthModule, RedisModule } from 'common'
import { AppConfigService, isEnv } from 'config'
import Redis from 'ioredis'
import { CustomersRepository } from './customers.repository'
import { CustomersService } from './customers.service'
import { Customer, CustomerSchema } from './models'

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Customer.name, schema: CustomerSchema }], 'mongo'),
        PassportModule,
        CacheModule.forRootAsync(
            {
                useFactory: (redis: Redis) => ({
                    redis,
                    prefix: isEnv('test') ? 'customer:' + generateShortId() : 'customer'
                }),
                inject: [RedisModule.getToken('redis')]
            },
            'customer'
        ),
        JwtAuthModule.forRootAsync(
            {
                useFactory: (config: AppConfigService, cache: CacheService) => ({
                    auth: config.auth,
                    cache
                }),
                inject: [AppConfigService, CacheService.getToken('customer')]
            },
            'customer'
        )
    ],
    providers: [CustomersService, CustomersRepository],
    exports: [CustomersService]
})
export class CustomersModule {}
