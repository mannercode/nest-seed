import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { PassportModule } from '@nestjs/passport'
import { generateUUID, JwtAuthModule } from 'common'
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
                    const prefix = isEnv('test') ? 'auth:' + generateUUID() : 'Auth'

                    return { ...config.auth, ...config.redis, prefix }
                },
                inject: [AppConfigService]
            },
            'Auth'
        )
    ],
    providers: [CustomersService, CustomersRepository],
    exports: [CustomersService]
})
export class CustomersModule {}
