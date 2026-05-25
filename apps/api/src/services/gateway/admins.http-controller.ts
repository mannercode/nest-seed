import { isDuplicateKeyError, Require } from '@mannercode/common'
import {
    Body,
    ConflictException,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Param,
    Post,
    Req,
    UseGuards
} from '@nestjs/common'
import { AdminRefreshTokenBodyDto, AdminsService, CreateAdminDto, ROOT_SUB } from 'core'
import { AdminAuthGuard, AdminLocalAuthGuard, AllowRoot, Public, RootAuthGuard } from './guards'
import { AdminAuthRequest } from './types'

// 인증/권한 분리:
// - login/refresh/logout: 공개 (LocalAuthGuard가 자격증명 검증)
// - GET /me: 일반 admin 자기 정보. AllowRoot로 root 토큰도 가드를 통과시키지만 컨트롤러가 NotFoundException으로 처리한다(root는 도큐먼트가 없음).
// - POST /, DELETE /:id: root 전용. admin CRUD 권한은 root만 가진다.
@Controller('admins')
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
    @UseGuards(AdminAuthGuard)
    @AllowRoot()
    async getMe(@Req() req: AdminAuthRequest) {
        if (req.user.sub === ROOT_SUB) {
            throw new NotFoundException()
        }
        const [admin] = await this.adminsService.getMany([req.user.sub])
        return admin
    }

    @Post()
    @UseGuards(RootAuthGuard)
    async create(@Body() body: CreateAdminDto) {
        try {
            return await this.adminsService.create(body)
        } catch (error) {
            if (isDuplicateKeyError(error)) {
                throw new ConflictException()
            }
            throw error
        }
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(RootAuthGuard)
    async remove(@Param('id') id: string) {
        await this.adminsService.remove(id)
    }
}
