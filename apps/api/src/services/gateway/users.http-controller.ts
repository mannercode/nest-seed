import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Ip,
    Patch,
    Post,
    Req,
    UnauthorizedException,
    UseGuards
} from '@nestjs/common'
import {
    RefreshTokenBodySchema,
    type RefreshTokenBodyDto,
    type UpdateUserDto,
    type UserCredentialsDto,
    UpdateUserSchema,
    UserCredentialsSchema,
    UsersService
} from '#core'
import {
    UserRegistrationService,
    RegisterUserSchema,
    CreateRegistrationPhotoSchema,
    type RegisterUserDto,
    type CreateRegistrationPhotoDto
} from '#application'
import type { UserAuthRequest } from './types.js'
import { AuthErrors, UserAuthGuard } from './guards/index.js'
import { LoginRateLimiterService } from './login-rate-limiter.service.js'

// 가입·로그인은 공개하고 본인 정보 경로에는 사용자 인증을 적용한다.
@Controller('users')
export class UsersHttpController {
    constructor(
        private readonly usersService: UsersService,
        private readonly registration: UserRegistrationService,
        private readonly loginRateLimiter: LoginRateLimiterService
    ) {}

    @Post()
    async create(@Body({ schema: RegisterUserSchema }) createDto: RegisterUserDto) {
        return this.registration.register(createDto)
    }

    @Post('photo-upload')
    async createPhotoUpload(
        @Body({ schema: CreateRegistrationPhotoSchema }) input: CreateRegistrationPhotoDto
    ) {
        return this.registration.createPhotoUpload(input)
    }

    @Delete('me')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(UserAuthGuard)
    async deleteMe(@Req() req: UserAuthRequest) {
        await this.registration.deleteUser(req.user.sub)
    }

    @HttpCode(HttpStatus.OK)
    @Post('login')
    async login(
        @Body({ schema: UserCredentialsSchema }) body: UserCredentialsDto,
        @Ip() ip: string
    ) {
        await this.loginRateLimiter.assertAllowed(ip)

        const result = await this.usersService.login(body)
        if (!result) {
            await this.loginRateLimiter.recordFailure(ip)
            throw new UnauthorizedException(AuthErrors.Unauthorized())
        }

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
}
