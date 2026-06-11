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

// 인가 모델 — 가드는 핸들러마다 명시한다.
// 클래스 수준 가드를 두면 메서드 가드가 그것에 "합쳐져"(둘 다 통과해야 함) admin 토큰이 user 가드에 막힌다.
// - 가드 없음(공개): 가입과 로그인·refresh·logout.
// - UserAuthGuard(본인 작업): /me 계열만 — 식별자를 토큰 주체(req.user.sub)로 못박아 임의 ID 접근(IDOR)을 구조적으로 막는다.
// - AdminAuthGuard(운영자): 임의 사용자 대상 작업 — "임의 ID = 운영자"로 일원화해 일반 user 토큰이 남의 ID를 만질 경로 자체를 두지 않는다.
// (역할별 권한은 README "인가" 절 참고)
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
