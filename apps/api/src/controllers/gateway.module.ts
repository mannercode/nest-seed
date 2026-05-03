import { Module } from '@nestjs/common'
import { ApplicationsModule } from 'applications'
import { CoresModule } from 'cores'
import { BookingHttpController } from './booking.http-controller'
import { CustomersHttpController } from './customers.http-controller'
import {
    CustomerJwtAuthGuard,
    CustomerLocalAuthGuard,
    CustomerOptionalJwtAuthGuard
} from './guards'
import { MoviesHttpController } from './movies.http-controller'
import { PurchaseHttpController } from './purchase.http-controller'
import { ShowtimeCreationHttpController } from './showtime-creation.http-controller'
import { TheatersHttpController } from './theaters.http-controller'

// Controllers/guards inject services from CoresModule and ApplicationsModule.
// NestJS DI is module-scoped: a controller can only resolve providers exported
// by modules its own module imports. So GatewayModule must import the layers
// it depends on explicitly — being declared as a sibling of CoresModule under
// AppModule does not grant access. (CommonModule is @Global so it doesn't
// need to be listed here.)
@Module({
    imports: [CoresModule, ApplicationsModule],
    controllers: [
        BookingHttpController,
        CustomersHttpController,
        MoviesHttpController,
        PurchaseHttpController,
        ShowtimeCreationHttpController,
        TheatersHttpController
    ],
    providers: [CustomerJwtAuthGuard, CustomerLocalAuthGuard, CustomerOptionalJwtAuthGuard]
})
export class GatewayModule {}
