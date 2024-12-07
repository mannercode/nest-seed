import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { PassportModule } from '@nestjs/passport'
import { generateShortId, generateUUID, JwtAuthModule } from 'common'
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
                useFactory: (config: AppConfigService) => ({
                    ...config.auth,
                    ...config.redis,
                    type: 'cluster',
                    prefix: isEnv('test') ? 'auth:' + generateShortId() : 'Auth'
                }),
                inject: [AppConfigService]
            },
            'Auth'
        )
    ],
    providers: [CustomersService, CustomersRepository],
    exports: [CustomersService]
})
export class CustomersModule {}
