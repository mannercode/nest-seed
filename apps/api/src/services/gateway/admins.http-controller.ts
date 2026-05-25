import { isDuplicateKeyError } from '@mannercode/common'
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
    UnauthorizedException,
    UseGuards
} from '@nestjs/common'
import {
    AdminCredentialsDto,
    AdminRefreshTokenBodyDto,
    AdminsService,
    CreateAdminDto,
    UpdateAdminDto
} from 'core'
import { AdminAuthGuard, AuthErrors, RootAuthGuard } from './guards'
import { AdminAuthRequest } from './types'

// 권한 분리:
// - login/refresh/logout: 가드 없음. 컨트롤러가 자격증명을 직접 검증해 토큰을 발급한다.
// - GET/PATCH /admins/me: admin 자신의 정보 (AdminAuthGuard, Bearer)
// - POST /admins, DELETE /admins/:id: admin lifecycle 관리 (RootAuthGuard, Basic)
@Controller('admins')
export class AdminsHttpController {
    constructor(private readonly adminsService: AdminsService) {}

    @HttpCode(HttpStatus.OK)
    @Post('login')
    async login(@Body() body: AdminCredentialsDto) {
        const admin = await this.adminsService.findAdminByCredentials(body)
        if (!admin) {
            throw new UnauthorizedException(AuthErrors.Unauthorized())
        }
        return this.adminsService.generateAuthTokens({ sub: admin.id, email: admin.email })
    }

    @HttpCode(HttpStatus.OK)
    @Post('refresh')
    async refreshToken(@Body() body: AdminRefreshTokenBodyDto) {
        return this.adminsService.refreshAuthTokens(body.refreshToken)
    }

    @HttpCode(HttpStatus.NO_CONTENT)
    @Post('logout')
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
