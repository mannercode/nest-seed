import { defaultTo } from '@mannercode/common'
import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import { UserHomeViewService } from 'view'
import { OptionalAuth, UserAuthGuard } from './guards'
import { UserOptionalAuthRequest } from './types'

// 사용자 앱 홈은 게스트도 접근하되, 로그인 시 추천을 개인화하므로 optional 사용자 가드를 단다.
// (게스트는 토큰이 없어도 통과하고 req.user가 비어 추천이 개봉일 순으로 채워진다.)
// URL의 `views/`는 다른 핸들러와의 복수형 관습을 따른다.
@Controller('views/user-app')
export class UserHomeViewHttpController {
    constructor(private readonly userHomeView: UserHomeViewService) {}

    @Get('home')
    @OptionalAuth()
    @UseGuards(UserAuthGuard)
    async home(@Req() req: UserOptionalAuthRequest) {
        const userId = defaultTo(req.user?.sub, null)
        return this.userHomeView.getHome(userId)
    }
}
