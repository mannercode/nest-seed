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
    AdminCredentialsDto,
    AdminRefreshTokenBodyDto,
    AdminsService,
    CreateAdminDto,
    UpdateAdminDto
} from 'core'
import { AdminAuthGuard, AuthErrors, RootAuthGuard } from './guards'
import { LoginRateLimiterService } from './login-rate-limiter.service'
import { AdminAuthRequest } from './types'

@Controller('admins')
export class AdminsHttpController {
    constructor(
        private readonly adminsService: AdminsService,
        private readonly loginRateLimiter: LoginRateLimiterService
    ) {}

    @HttpCode(HttpStatus.OK)
    @Post('login')
    async login(@Body() body: AdminCredentialsDto, @Ip() ip: string) {
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
        return this.adminsService.update(req.user.sub, body)
    }

    @Post()
    @UseGuards(RootAuthGuard)
    async create(@Body() body: CreateAdminDto) {
        return this.adminsService.create(body)
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(RootAuthGuard)
    async remove(@Param('id') id: string) {
        await this.adminsService.remove(id)
    }
}
