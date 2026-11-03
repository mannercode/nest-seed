import {
    AppLoggerService,
    HttpExceptionLoggerFilter,
    HttpSuccessLoggerInterceptor,
    RestateEndpoint
} from '@mannercode/common'
import { Module } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { UserRegistrationModule } from '#application'
import { AppConfigService } from '#config'
import { UsersModule } from '#core'
import {
    EventDemoHttpController,
    JobDemoHttpController,
    LoginRateLimiterService,
    RequestValidationPipe,
    UserAuthGuard,
    WebHomeViewHttpController,
    UsersHttpController
} from '#gateway'
import { AssetsModule, EventDemoModule, JobDemoModule, TextJobWorkflow } from '#infrastructure'
import { WebHomeViewModule } from '#view'
import { AppConfigModule, GlobalModule, HealthModule } from './modules/index.js'

@Module({
    imports: [
        GlobalModule,
        AppConfigModule,
        HealthModule,
        UsersModule,
        AssetsModule,
        UserRegistrationModule,
        EventDemoModule,
        JobDemoModule,
        WebHomeViewModule
    ],
    controllers: [
        UsersHttpController,
        WebHomeViewHttpController,
        EventDemoHttpController,
        JobDemoHttpController
    ],
    providers: [
        LoginRateLimiterService,
        UserAuthGuard,
        {
            provide: RestateEndpoint,
            inject: [TextJobWorkflow, AppConfigService, AppLoggerService],
            useFactory: (
                workflow: TextJobWorkflow,
                config: AppConfigService,
                logger: AppLoggerService
            ) => new RestateEndpoint([workflow.definition], config.restate.servicePort, logger)
        },
        { provide: 'LOGGING_EXCLUDE_HTTP_PATHS', useValue: ['/health'] },
        { provide: APP_PIPE, useClass: RequestValidationPipe },
        { provide: APP_FILTER, useClass: HttpExceptionLoggerFilter },
        { provide: APP_INTERCEPTOR, useClass: HttpSuccessLoggerInterceptor }
    ]
})
export class AppModule {}
