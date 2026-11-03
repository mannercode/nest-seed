import { defaultTo } from '@mannercode/common'
import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import { WebHomeViewService } from '#view'
import type { UserOptionalAuthRequest } from './types.js'
import { OptionalAuth, UserAuthGuard } from './guards/index.js'

@Controller('views/web')
export class WebHomeViewHttpController {
    constructor(private readonly webHomeView: WebHomeViewService) {}

    @Get('home')
    @OptionalAuth()
    @UseGuards(UserAuthGuard)
    async home(@Req() req: UserOptionalAuthRequest) {
        const userId = defaultTo(req.user?.sub, null)
        return this.webHomeView.getHome(userId)
    }
}
