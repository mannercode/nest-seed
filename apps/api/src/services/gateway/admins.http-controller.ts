import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Ip,
    Param,
    Patch,
    Post,
    Req,
    UnauthorizedException,
    UseGuards
} from '@nestjs/common'
import {
    AdminCredentialsSchema,
    AdminRefreshTokenBodySchema,
    AdminsService,
    CreateAdminSchema,
    type AdminCredentialsDto,
    type AdminRefreshTokenBodyDto,
    type CreateAdminDto,
    type UpdateAdminDto,
    UpdateAdminSchema
} from '#core'
import type { AdminAuthRequest } from './types.js'
import { AdminAuthGuard, AuthErrors, RootAuthGuard } from './guards/index.js'
import { LoginRateLimiterService } from './login-rate-limiter.service.js'

@Controller('admins')
export class AdminsHttpController {
    constructor(
        private readonly adminsService: AdminsService,
        private readonly loginRateLimiter: LoginRateLimiterService
    ) {}

    @HttpCode(HttpStatus.OK)
    @Post('login')
    async login(
        @Body({ schema: AdminCredentialsSchema }) body: AdminCredentialsDto,
        @Ip() ip: string
    ) {
        await this.loginRateLimiter.assertAllowed('admin', body.email, ip)

        const result = await this.adminsService.login(body)
        if (!result) {
            await this.loginRateLimiter.recordFailure('admin', body.email, ip)
            throw new UnauthorizedException(AuthErrors.Unauthorized())
        }

        await this.loginRateLimiter.resetAccount('admin', body.email)
        return result.tokens
    }

    @HttpCode(HttpStatus.OK)
    @Post('refresh')
    async refreshToken(
        @Body({ schema: AdminRefreshTokenBodySchema }) body: AdminRefreshTokenBodyDto
    ) {
        return this.adminsService.refreshAuthTokens(body.refreshToken)
    }

    @HttpCode(HttpStatus.NO_CONTENT)
    @Post('logout')
    async logout(@Body({ schema: AdminRefreshTokenBodySchema }) body: AdminRefreshTokenBodyDto) {
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
    async updateMe(
        @Req() req: AdminAuthRequest,
        @Body({ schema: UpdateAdminSchema }) body: UpdateAdminDto
    ) {
        return this.adminsService.update(req.user.sub, body)
    }

    @Post()
    @UseGuards(RootAuthGuard)
    async create(@Body({ schema: CreateAdminSchema }) body: CreateAdminDto) {
        return this.adminsService.create(body)
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(RootAuthGuard)
    async remove(@Param('id') id: string) {
        await this.adminsService.remove(id)
    }
}
