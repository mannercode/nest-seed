import { Module } from '@nestjs/common'
import { ApplicationsModule } from 'applications'
import { CoresModule } from 'cores'
import { BookingHttpController } from './booking.http-controller'
import { UserJwtAuthGuard, UserLocalAuthGuard, UserOptionalJwtAuthGuard } from './guards'
import { MoviesHttpController } from './movies.http-controller'
import { PurchaseHttpController } from './purchase.http-controller'
import { ShowtimeCreationHttpController } from './showtime-creation.http-controller'
import { TheatersHttpController } from './theaters.http-controller'
import { UsersHttpController } from './users.http-controller'

// Controllers/guards 가 CoresModule 과 ApplicationsModule 의 service 를 주입받는다.
// NestJS DI 는 module 단위 scope — controller 는 자기 module 이 import 한 module 이
// export 한 provider 만 resolve 할 수 있다. 그래서 GatewayModule 이 의존하는 layer 를
// 명시적으로 import 해야 한다. AppModule 아래에서 CoresModule 과 형제로 선언돼 있다고
// 접근권이 생기는 게 아니다. (CommonModule 은 @Global 이라 여기 나열할 필요 없음.)
@Module({
    imports: [CoresModule, ApplicationsModule],
    controllers: [
        BookingHttpController,
        UsersHttpController,
        MoviesHttpController,
        PurchaseHttpController,
        ShowtimeCreationHttpController,
        TheatersHttpController
    ],
    providers: [UserJwtAuthGuard, UserLocalAuthGuard, UserOptionalJwtAuthGuard]
})
export class GatewayModule {}
