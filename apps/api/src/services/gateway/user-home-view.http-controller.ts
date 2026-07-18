import { defaultTo } from '@mannercode/common'
import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import { UserHomeViewService } from 'view'
import { OptionalAuth, UserAuthGuard } from './guards'
import { UserOptionalAuthRequest } from './types'

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
