import { Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ApplicationsModule } from 'applications'
import { CommonModule, MongooseConfigModule, RedisConfigModule } from 'common'
import { CoresModule } from 'cores'
import { InfrastructuresModule } from 'infrastructures'
import {
    BookingHttpController,
    CustomerJwtStrategy,
    CustomerLocalStrategy,
    CustomersHttpController,
    MoviesHttpController,
    PurchaseHttpController,
    ShowtimeCreationHttpController,
    TheatersHttpController
} from './controllers'
import { HealthModule } from './modules'

@Module({
    controllers: [
        CustomersHttpController,
        MoviesHttpController,
        TheatersHttpController,
        ShowtimeCreationHttpController,
        BookingHttpController,
        PurchaseHttpController
    ],
    imports: [
        CommonModule,
        MongooseConfigModule,
        RedisConfigModule,
        EventEmitterModule.forRoot(),
        HealthModule,
        CoresModule,
        InfrastructuresModule,
        ApplicationsModule
    ],
    providers: [CustomerLocalStrategy, CustomerJwtStrategy]
})
export class AppModule {}
