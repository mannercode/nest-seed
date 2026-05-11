import { Require } from '@mannercode/common'
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
    UseGuards
} from '@nestjs/common'
import {
    CreateUserDto,
    RefreshTokenBodyDto,
    SearchUsersPageDto,
    UpdateUserDto,
    UsersService
} from 'core'
import { UserJwtAuthGuard, UserLocalAuthGuard, Public } from './guards'
import { UserAuthRequest } from './types'

// 인가: 클래스 레벨 JWT 가드 외에는 owner/admin 검사를 비워 두었다.
// 지금 상태에서는 로그인한 사용자가 다른 사용자 ID 의 데이터를 읽고
// 바꾸고 지울 수 있다. 목록 조회도 모든 사용자의 개인 정보를 그대로
// 돌려준다. 포크해서 쓸 때는 본인만 접근하는 핸들러에
// `req.user.sub === userId` 검사를, 관리자 전용 핸들러에는 admin 가드를
// 붙인다. 자세한 안내는 README "5. 인가" 절에 있다.
@Controller('users')
@UseGuards(UserJwtAuthGuard)
export class UsersHttpController {
    constructor(private readonly usersService: UsersService) {}

    @Post()
    @Public()
    async create(@Body() createDto: CreateUserDto) {
        return this.usersService.create(createDto)
    }

    @Delete(':userId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(@Param('userId') userId: string) {
        await this.usersService.deleteMany([userId])
    }

    @HttpCode(HttpStatus.OK)
    @Post('login')
    @UseGuards(UserLocalAuthGuard)
    async login(@Req() req: UserAuthRequest) {
        Require.defined(req.user, 'req.user must be returned in LocalStrategy.validate')

        return this.usersService.generateAuthTokens(req.user)
    }

    @HttpCode(HttpStatus.OK)
    @Post('refresh')
    @Public()
    async refreshToken(@Body() body: RefreshTokenBodyDto) {
        return this.usersService.refreshAuthTokens(body.refreshToken)
    }

    @HttpCode(HttpStatus.NO_CONTENT)
    @Post('logout')
    @Public()
    async logout(@Body() body: RefreshTokenBodyDto) {
        await this.usersService.revokeRefreshToken(body.refreshToken)
    }

    @HttpCode(HttpStatus.NO_CONTENT)
    @Post('me/logout-all')
    async logoutAll(@Req() req: UserAuthRequest) {
        await this.usersService.revokeAllForUser(req.user.sub)
    }

    @Get('me')
    async getMe(@Req() req: UserAuthRequest) {
        const [user] = await this.usersService.getMany([req.user.sub])
        return user
    }

    @Get()
    async searchPage(@Query() searchDto: SearchUsersPageDto) {
        return this.usersService.searchPage(searchDto)
    }

    @Get(':userId')
    async get(@Param('userId') userId: string) {
        const [user] = await this.usersService.getMany([userId])
        return user
    }

    @Patch(':userId')
    async update(@Param('userId') userId: string, @Body() updateDto: UpdateUserDto) {
        return this.usersService.update(userId, updateDto)
    }
}
