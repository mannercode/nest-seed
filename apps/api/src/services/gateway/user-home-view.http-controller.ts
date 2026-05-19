import { Controller, Get } from '@nestjs/common'
import { UserHomeViewService } from 'view'

// 사용자 앱 홈은 게스트 접근이라 가드를 두지 않는다.
// URL의 `views/`는 다른 핸들러와의 복수형 관습을 따른다.
@Controller('views/user-app')
export class UserHomeViewHttpController {
    constructor(private readonly userHomeView: UserHomeViewService) {}

    @Get('home')
    async home() {
        return this.userHomeView.getHome()
    }
}
