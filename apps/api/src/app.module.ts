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
    AdminsModule,
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
    AdminAuthGuard,
    AdminLocalAuthGuard,
    AdminsHttpController,
    BookingHttpController,
    MoviesHttpController,
    PurchaseHttpController,
    RequestValidationPipe,
    ShowtimeCreationHttpController,
    TheatersHttpController,
    UserAuthGuard,
    UserHomeViewHttpController,
    UserLocalAuthGuard,
    UserOptionalAuthGuard,
    UsersHttpController
} from 'gateway'
import { AssetsModule, PaymentsModule } from 'infrastructure'
import { UserHomeViewModule } from 'view'
import { AppConfigModule, GlobalModule, HealthModule } from './modules'

@Module({
    imports: [
        GlobalModule,
        AppConfigModule,
        HealthModule,
        AdminsModule,
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
        ShowtimeCreationModule,
        UserHomeViewModule
    ],
    controllers: [
        AdminsHttpController,
        BookingHttpController,
        UsersHttpController,
        MoviesHttpController,
        PurchaseHttpController,
        ShowtimeCreationHttpController,
        TheatersHttpController,
        UserHomeViewHttpController
    ],
    providers: [
        AdminAuthGuard,
        AdminLocalAuthGuard,
        UserAuthGuard,
        UserLocalAuthGuard,
        UserOptionalAuthGuard,
        { provide: APP_PIPE, useClass: RequestValidationPipe },
        { provide: APP_FILTER, useClass: HttpExceptionLoggerFilter },
        { provide: APP_INTERCEPTOR, useClass: HttpSuccessLoggerInterceptor }
    ]
})
export class AppModule {}
