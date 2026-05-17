import { HttpExceptionLoggerFilter, HttpSuccessLoggerInterceptor } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import {
    BookingModule,
    PurchaseModule,
    RecommendationModule,
    ShowtimeCreationModule
} from 'application'
import {
    MoviesModule,
    PurchaseRecordsModule,
    ShowtimesModule,
    TheatersModule,
    TicketHoldingModule,
    TicketsModule,
    UsersModule,
    WatchRecordsModule
} from 'core'
import {
    BookingHttpController,
    MoviesHttpController,
    PurchaseHttpController,
    RequestValidationPipe,
    ShowtimeCreationHttpController,
    TheatersHttpController,
    UserJwtAuthGuard,
    UserLocalAuthGuard,
    UserOptionalJwtAuthGuard,
    UsersHttpController
} from 'gateway'
import { AssetsModule, PaymentsModule } from 'infrastructure'
import { AppConfigModule, GlobalModule, HealthModule } from './modules'

@Module({
    imports: [
        GlobalModule,
        AppConfigModule,
        HealthModule,
        UsersModule,
        MoviesModule,
        TheatersModule,
        ShowtimesModule,
        TicketsModule,
        TicketHoldingModule,
        WatchRecordsModule,
        PurchaseRecordsModule,
        PaymentsModule,
        AssetsModule,
        BookingModule,
        PurchaseModule,
        RecommendationModule,
        ShowtimeCreationModule
    ],
    controllers: [
        BookingHttpController,
        UsersHttpController,
        MoviesHttpController,
        PurchaseHttpController,
        ShowtimeCreationHttpController,
        TheatersHttpController
    ],
    providers: [
        UserJwtAuthGuard,
        UserLocalAuthGuard,
        UserOptionalJwtAuthGuard,
        { provide: APP_PIPE, useClass: RequestValidationPipe },
        { provide: APP_FILTER, useClass: HttpExceptionLoggerFilter },
        { provide: APP_INTERCEPTOR, useClass: HttpSuccessLoggerInterceptor }
    ]
})
export class AppModule {}
