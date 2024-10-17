import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { PassportModule } from '@nestjs/passport'
import { JwtAuthService } from 'common'
import { AppConfigService } from 'config'
import { CustomersRepository } from './customers.repository'
import { CustomersService } from './customers.service'
import { Customer, CustomerSchema } from './models'

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Customer.name, schema: CustomerSchema }]),
        PassportModule
    ],
    providers: [
        CustomersService,
        CustomersRepository,
        JwtAuthService,
        {
            provide: 'AuthConfig',
            useFactory: (config: AppConfigService) => config.auth,
            inject: [AppConfigService]
        }
    ],
    exports: [CustomersService]
})
export class CustomersModule {}
