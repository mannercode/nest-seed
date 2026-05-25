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
    Patch,
    Post,
    Req,
    UseGuards
} from '@nestjs/common'
import { AdminRefreshTokenBodyDto, AdminsService, CreateAdminDto, UpdateAdminDto } from 'core'
import { AdminAuthGuard, AdminLocalAuthGuard, Public, RootAuthGuard } from './guards'
import { AdminAuthRequest } from './types'

// 권한 분리:
// - login/refresh/logout: 공개 (LocalAuthGuard가 자격증명 검증)
// - GET/PATCH /admins/me: admin 자신의 정보 (AdminAuthGuard)
// - POST /admins, DELETE /admins/:id: admin lifecycle 관리 (RootAuthGuard, Basic Auth)
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
    async getMe(@Req() req: AdminAuthRequest) {
        const [admin] = await this.adminsService.getMany([req.user.sub])
        return admin
    }

    @Patch('me')
    @UseGuards(AdminAuthGuard)
    async updateMe(@Req() req: AdminAuthRequest, @Body() body: UpdateAdminDto) {
        try {
            const updated = await this.adminsService.update(req.user.sub, body)
            if (!updated) {
                throw new NotFoundException()
            }
            return updated
        } catch (error) {
            if (isDuplicateKeyError(error)) {
                throw new ConflictException()
            }
            throw error
        }
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
