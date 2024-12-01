import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { PassportModule } from '@nestjs/passport'
import { generateShortId, JwtAuthModule, RedisModule } from 'common'
import { AppConfigService, isEnv } from 'config'
import Redis from 'ioredis'
import { CustomersRepository } from './customers.repository'
import { CustomersService } from './customers.service'
import { Customer, CustomerSchema } from './models'

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Customer.name, schema: CustomerSchema }], 'mongo'),
        PassportModule,
        JwtAuthModule.forRootAsync(
            {
                useFactory: (config: AppConfigService, redis: Redis) => ({
                    auth: config.auth,
                    prefix: isEnv('test') ? 'auth:' + generateShortId() : 'Auth',
                    redis
                }),
                inject: [AppConfigService, RedisModule.getConnectionToken('redis')]
            },
            'Customer'
        )
    ],
    providers: [CustomersService, CustomersRepository],
    exports: [CustomersService]
})
export class CustomersModule {}
