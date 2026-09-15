import {
    AppLoggerService,
    HttpExceptionLoggerFilter,
    HttpSuccessLoggerInterceptor,
    RestateEndpoint
} from '@mannercode/common'
import { Module } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import {
    BookingModule,
    CatalogManagementModule,
    PurchaseModule,
    PurchaseWorkflow,
    PurchaseEventWorkflow,
    RecommendationModule,
    ShowtimeCreationModule,
    ShowtimeCreationWorkflow
} from '#application'
import { AppConfigService } from '#config'
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
} from '#core'
import {
    AdminAuthGuard,
    AdminsHttpController,
    BookingHttpController,
    MoviesHttpController,
    LoginRateLimiterService,
    PurchaseHttpController,
    RequestValidationPipe,
    ShowtimeCreationHttpController,
    TheatersHttpController,
    UserAuthGuard,
    UserHomeViewHttpController,
    UsersHttpController
} from '#gateway'
import { AssetsModule, PaymentsModule } from '#infrastructure'
import { UserHomeViewModule } from '#view'
import { AppConfigModule, GlobalModule, HealthModule } from './modules/index.js'

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
        CatalogManagementModule,
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
        LoginRateLimiterService,
        UserAuthGuard,
        {
            provide: RestateEndpoint,
            inject: [
                ShowtimeCreationWorkflow,
                PurchaseWorkflow,
                PurchaseEventWorkflow,
                AppConfigService,
                AppLoggerService
            ],
            useFactory: (
                showtime: ShowtimeCreationWorkflow,
                purchase: PurchaseWorkflow,
                event: PurchaseEventWorkflow,
                config: AppConfigService,
                logger: AppLoggerService
            ) =>
                new RestateEndpoint(
                    [showtime.definition, purchase.definition, event.definition],
                    config.restate.servicePort,
                    logger
                )
        },
        { provide: 'LOGGING_EXCLUDE_HTTP_PATHS', useValue: ['/health'] },
        { provide: APP_PIPE, useClass: RequestValidationPipe },
        { provide: APP_FILTER, useClass: HttpExceptionLoggerFilter },
        { provide: APP_INTERCEPTOR, useClass: HttpSuccessLoggerInterceptor }
    ]
})
export class AppModule {}
