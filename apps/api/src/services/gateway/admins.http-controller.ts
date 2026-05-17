import { Require } from '@mannercode/common'
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common'
import { AdminRefreshTokenBodyDto, AdminsService } from 'core'
import { AdminAuthGuard, AdminLocalAuthGuard, Public } from './guards'
import { AdminAuthRequest } from './types'

// admin은 시드 1명으로 운영하므로 가입/수정/삭제 엔드포인트는 두지 않는다.
// 자기 정보 조회와 토큰 수명 관리만 노출한다.
@Controller('admins')
@UseGuards(AdminAuthGuard)
export class AdminsHttpController {
    constructor(private readonly adminsService: AdminsService) {}

    @HttpCode(HttpStatus.OK)
    @Post('login')
    @Public()
    @UseGuards(AdminLocalAuthGuard)
    async login(@Req() req: AdminAuthRequest) {
        Require.defined(req.user, 'req.user must be returned in LocalStrategy.validate')

        return this.adminsService.generateAuthTokens(req.user)
    }

    @HttpCode(HttpStatus.OK)
    @Post('refresh')
    @Public()
    async refreshToken(@Body() body: AdminRefreshTokenBodyDto) {
        return this.adminsService.refreshAuthTokens(body.refreshToken)
    }

    @HttpCode(HttpStatus.NO_CONTENT)
    @Post('logout')
    @Public()
    async logout(@Body() body: AdminRefreshTokenBodyDto) {
        await this.adminsService.revokeRefreshToken(body.refreshToken)
    }

    @Get('me')
    async getMe(@Req() req: AdminAuthRequest) {
        const [admin] = await this.adminsService.getMany([req.user.sub])
        return admin
    }
}
