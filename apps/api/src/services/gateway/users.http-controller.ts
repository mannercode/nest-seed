import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UnauthorizedException,
    UseGuards
} from '@nestjs/common'
import {
    CreateUserDto,
    PurchaseRecordsService,
    RefreshTokenBodyDto,
    SearchUsersPageDto,
    UpdateUserDto,
    UserCredentialsDto,
    UsersService
} from 'core'
import { AdminAuthGuard, AuthErrors, UserAuthGuard } from './guards'
import { UserAuthRequest } from './types'

// Nest는 클래스와 메서드 가드를 모두 요구하므로 역할별 가드는 메서드에만 둔다.
@Controller('users')
export class UsersHttpController {
    constructor(
        private readonly usersService: UsersService,
        private readonly purchaseRecordsService: PurchaseRecordsService
    ) {}

    @Post()
    async create(@Body() createDto: CreateUserDto) {
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
    async login(@Body() body: UserCredentialsDto) {
        const user = await this.usersService.findUserByCredentials(body)
        if (!user) {
            throw new UnauthorizedException(AuthErrors.Unauthorized())
        }
        return this.usersService.generateAuthTokens({ sub: user.id, email: user.email })
    }

    @HttpCode(HttpStatus.OK)
    @Post('refresh')
    async refreshToken(@Body() body: RefreshTokenBodyDto) {
        return this.usersService.refreshAuthTokens(body.refreshToken)
    }

    @HttpCode(HttpStatus.NO_CONTENT)
    @Post('logout')
    async logout(@Body() body: RefreshTokenBodyDto) {
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
    async updateMe(@Req() req: UserAuthRequest, @Body() updateDto: UpdateUserDto) {
        return this.usersService.update(req.user.sub, updateDto)
    }

    @Get('me/purchases')
    @UseGuards(UserAuthGuard)
    async getMyPurchases(@Req() req: UserAuthRequest) {
        return this.purchaseRecordsService.findByUserId(req.user.sub)
    }

    @Get()
    @UseGuards(AdminAuthGuard)
    async searchPage(@Query() searchDto: SearchUsersPageDto) {
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
    async update(@Param('userId') userId: string, @Body() updateDto: UpdateUserDto) {
        return this.usersService.update(userId, updateDto)
    }
}
