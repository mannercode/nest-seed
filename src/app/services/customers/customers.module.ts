import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { PassportModule } from '@nestjs/passport'
import { AUTH_CONFIG, CacheModule, generateUUID, JwtAuthModule, JwtAuthService } from 'common'
import { AppConfigService, isEnv } from 'config'
import { CustomersRepository } from './customers.repository'
import { CustomersService } from './customers.service'
import { Customer, CustomerSchema } from './models'

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Customer.name, schema: CustomerSchema }]),
        PassportModule,
        JwtAuthModule.forRootAsync(
            {
                useFactory: (config: AppConfigService) => {
                    const { host, port } = config.customerAuth
                    const prefix = isEnv('test') ? 'auth:' + generateUUID() : 'CustomerAuth'

                    return { host, port, prefix, ...config.auth }
                },
                inject: [AppConfigService]
            },
            'CustomerAuth'
        )
    ],
    providers: [
        CustomersService,
        CustomersRepository
    ],
    exports: [CustomersService]
})
export class CustomersModule {}
