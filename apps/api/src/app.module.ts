import { HttpExceptionLoggerFilter, HttpSuccessLoggerInterceptor } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { ApplicationModule } from 'application'
import { CoreModule } from 'core'
import { GatewayModule, HealthModule, RequestValidationPipe } from 'gateway'
import { InfrastructureModule } from 'infrastructure'
import {
    MongooseConfigModule,
    NatsConfigModule,
    RedisConfigModule,
    TemporalConfigModule
} from 'shared'
import { GlobalModule } from './global.module'

@Module({
    imports: [
        GlobalModule,
        MongooseConfigModule,
        RedisConfigModule,
        NatsConfigModule,
        TemporalConfigModule,
        HealthModule,
        CoreModule,
        InfrastructureModule,
        ApplicationModule,
        GatewayModule
    ],
    providers: [
        { provide: APP_PIPE, useClass: RequestValidationPipe },
        { provide: APP_FILTER, useClass: HttpExceptionLoggerFilter },
        { provide: APP_INTERCEPTOR, useClass: HttpSuccessLoggerInterceptor }
    ]
})
export class AppModule {}
