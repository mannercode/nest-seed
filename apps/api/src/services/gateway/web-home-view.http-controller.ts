import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import { WebHomeViewService } from '#view'
import type { UserAuthRequest } from './types.js'
import { UserAuthGuard } from './guards/index.js'

@Controller('views/web')
@UseGuards(UserAuthGuard)
export class WebHomeViewHttpController {
    constructor(private readonly webHomeView: WebHomeViewService) {}
    @Get('home')
    async home(@Req() req: UserAuthRequest) {
        return this.webHomeView.getHome(req.user.sub)
    }
}
