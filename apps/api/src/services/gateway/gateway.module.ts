import { HttpExceptionLoggerFilter, HttpSuccessLoggerInterceptor } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { ApplicationModule } from 'application'
import { CoreModule } from 'core'
import { BookingHttpController } from './booking.http-controller'
import { UserJwtAuthGuard, UserLocalAuthGuard, UserOptionalJwtAuthGuard } from './guards'
import { MoviesHttpController } from './movies.http-controller'
import { RequestValidationPipe } from './pipes'
import { PurchaseHttpController } from './purchase.http-controller'
import { ShowtimeCreationHttpController } from './showtime-creation.http-controller'
import { TheatersHttpController } from './theaters.http-controller'
import { UsersHttpController } from './users.http-controller'

// Controllers/guards 가 CoreModule 과 ApplicationModule 의 service 를 주입받는다.
// NestJS DI 는 module 단위 scope — controller 는 자기 module 이 import 한 module 이
// export 한 provider 만 resolve 할 수 있다. 그래서 GatewayModule 이 의존하는 layer 를
// 명시적으로 import 해야 한다. AppModule 아래에서 CoreModule 과 형제로 선언돼 있다고
// 접근권이 생기는 게 아니다. (GlobalModule 은 @Global 이라 여기 나열할 필요 없음.)
//
// APP_PIPE / APP_FILTER / APP_INTERCEPTOR 는 HTTP 경계의 cross-cutting 처리라
// gateway 의 책임이다. 어느 모듈에 등록하든 앱 전체에 적용되지만, 의미상 여기 둔다.
@Module({
    imports: [CoreModule, ApplicationModule],
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
export class GatewayModule {}
