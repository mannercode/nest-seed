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
    Query,
    Req,
    UnauthorizedException,
    UseGuards
} from '@nestjs/common'
import {
    CreateUserSchema,
    PurchaseRecordsService,
    RefreshTokenBodySchema,
    SearchUsersPageSchema,
    type CreateUserDto,
    type RefreshTokenBodyDto,
    type SearchUsersPageDto,
    type UpdateUserDto,
    type UserCredentialsDto,
    UpdateUserSchema,
    UserCredentialsSchema,
    UsersService
} from '#core'
import type { UserAuthRequest } from './types.js'
import { AdminAuthGuard, AuthErrors, UserAuthGuard } from './guards/index.js'
import { LoginRateLimiterService } from './login-rate-limiter.service.js'

// 클래스와 메서드 가드는 누적 적용된다. 공개·user·admin 라우트가 섞여 있으므로 역할 가드는 메서드에만 둔다.
@Controller('users')
export class UsersHttpController {
    constructor(
        private readonly usersService: UsersService,
        private readonly purchaseRecordsService: PurchaseRecordsService,
        private readonly loginRateLimiter: LoginRateLimiterService
    ) {}

    @Post()
    async create(@Body({ schema: CreateUserSchema }) createDto: CreateUserDto) {
        return this.usersService.create(createDto)
    }

    // 라우트 매칭상 `me`를 `:userId`보다 먼저 선언해야 `/users/me`가 파라미터로 잡히지 않는다.
    @Delete('me')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(UserAuthGuard)
    async deleteMe(@Req() req: UserAuthRequest) {
        await this.usersService.deleteMany([req.user.sub])
    }

    @Delete(':userId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(AdminAuthGuard)
    async delete(@Param('userId') userId: string) {
        await this.usersService.deleteMany([userId])
    }

    @HttpCode(HttpStatus.OK)
    @Post('login')
    async login(
        @Body({ schema: UserCredentialsSchema }) body: UserCredentialsDto,
        @Ip() ip: string
    ) {
        await this.loginRateLimiter.assertAllowed('user', body.email, ip)

        const result = await this.usersService.login(body)
        if (!result) {
            await this.loginRateLimiter.recordFailure('user', body.email, ip)
            throw new UnauthorizedException(AuthErrors.Unauthorized())
        }

        await this.loginRateLimiter.resetAccount('user', body.email)
        return result.tokens
    }

    @HttpCode(HttpStatus.OK)
    @Post('refresh')
    async refreshToken(@Body({ schema: RefreshTokenBodySchema }) body: RefreshTokenBodyDto) {
        return this.usersService.refreshAuthTokens(body.refreshToken)
    }

    @HttpCode(HttpStatus.NO_CONTENT)
    @Post('logout')
    async logout(@Body({ schema: RefreshTokenBodySchema }) body: RefreshTokenBodyDto) {
        await this.usersService.revokeRefreshToken(body.refreshToken)
    }

    @HttpCode(HttpStatus.NO_CONTENT)
    @Post('me/logout-all')
    @UseGuards(UserAuthGuard)
    async logoutAll(@Req() req: UserAuthRequest) {
        await this.usersService.revokeAllForUser(req.user.sub)
    }

    @Get('me')
    @UseGuards(UserAuthGuard)
    async getMe(@Req() req: UserAuthRequest) {
        const [user] = await this.usersService.getMany([req.user.sub])
        return user
    }

    @Patch('me')
    @UseGuards(UserAuthGuard)
    async updateMe(
        @Req() req: UserAuthRequest,
        @Body({ schema: UpdateUserSchema }) updateDto: UpdateUserDto
    ) {
        return this.usersService.update(req.user.sub, updateDto)
    }

    @Get('me/purchases')
    @UseGuards(UserAuthGuard)
    async getMyPurchases(@Req() req: UserAuthRequest) {
        return this.purchaseRecordsService.findByUserId(req.user.sub)
    }

    @Get()
    @UseGuards(AdminAuthGuard)
    async searchPage(@Query({ schema: SearchUsersPageSchema }) searchDto: SearchUsersPageDto) {
        return this.usersService.searchPage(searchDto)
    }

    @Get(':userId')
    @UseGuards(AdminAuthGuard)
    async get(@Param('userId') userId: string) {
        const [user] = await this.usersService.getMany([userId])
        return user
    }

    @Patch(':userId')
    @UseGuards(AdminAuthGuard)
    async update(
        @Param('userId') userId: string,
        @Body({ schema: UpdateUserSchema }) updateDto: UpdateUserDto
    ) {
        return this.usersService.update(userId, updateDto)
    }
}
