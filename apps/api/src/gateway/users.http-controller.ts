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
} from 'cores'
import { UserJwtAuthGuard, UserLocalAuthGuard, Public } from './guards'
import { UserAuthRequest } from './types'

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
