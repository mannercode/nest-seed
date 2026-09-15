import { ensure, mapDocToDto } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import {
    CreateUserDto,
    UserCredentialsDto,
    SearchUsersPageDto,
    UpdateUserDto,
    UserDto
} from './dtos/index.js'
import { UserAuthenticationService } from './internal/index.js'
import { User } from './models/index.js'
import { UsersRepository } from './users.repository.js'

@Injectable()
export class UsersService {
    constructor(
        private readonly repository: UsersRepository,
        private readonly authenticationService: UserAuthenticationService
    ) {}

    async create(createDto: CreateUserDto) {
        const password = await this.authenticationService.hash(createDto.password)

        const user = await this.repository.create({ ...createDto, password })
        return this.toDto(user)
    }

    async deleteMany(userIds: string[]): Promise<void> {
        await this.repository.deleteMany({ ids: userIds })
        await Promise.all(userIds.map((id) => this.authenticationService.revokeAllForUser(id)))
    }

    async login(credentials: UserCredentialsDto) {
        const user = await this.authenticationService.authenticate(credentials)
        if (!user) return null

        const tokens = await this.authenticationService.generateAuthTokens({
            email: user.email,
            sub: user.id
        })
        return { tokens, user: this.toDto(user) }
    }

    async getMany(userIds: string[]) {
        const users = await this.repository.getMany({ ids: userIds })

        return this.toDtos(users)
    }

    async refreshAuthTokens(refreshToken: string) {
        return this.authenticationService.refreshAuthTokens(refreshToken)
    }

    async revokeAllForUser(userId: string): Promise<void> {
        await this.authenticationService.revokeAllForUser(userId)
    }

    async revokeRefreshToken(refreshToken: string): Promise<void> {
        await this.authenticationService.revokeRefreshToken(refreshToken)
    }

    async searchPage(searchDto: SearchUsersPageDto) {
        const { items, ...pagination } = await this.repository.searchPage(searchDto)

        return { ...pagination, items: this.toDtos(items) }
    }

    async update(userId: string, updateDto: UpdateUserDto) {
        const patch = { ...updateDto }
        if (typeof patch.password === 'string') {
            patch.password = await this.authenticationService.hash(patch.password)
        }

        const user = await this.repository.update(userId, patch)
        // 비밀번호가 바뀌면 기존 리프레시 토큰 묶음은 더 이상 신뢰할 수 없으므로 함께 회수한다.
        if (patch.password !== undefined) {
            await this.authenticationService.revokeAllForUser(userId)
        }
        return this.toDto(user)
    }

    private toDto(user: User) {
        return ensure(this.toDtos([user])[0])
    }

    private toDtos(users: User[]) {
        return users.map((user) => mapDocToDto(user, UserDto, ['id', 'name', 'email', 'birthDate']))
    }
}
