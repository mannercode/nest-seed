import { ensure, isDuplicateKeyError, mapDocToDto } from '@mannercode/common'
import { ConflictException, Injectable } from '@nestjs/common'
import {
    CreateUserDto,
    UserCredentialsDto,
    SearchUsersPageDto,
    UpdateUserDto,
    UserDto
} from './dtos'
import { UserErrors } from './errors'
import { UserAuthenticationService } from './internal'
import { User } from './models'
import { UsersRepository } from './users.repository'

@Injectable()
export class UsersService {
    constructor(
        private readonly repository: UsersRepository,
        private readonly authenticationService: UserAuthenticationService
    ) {}

    async create(createDto: CreateUserDto) {
        const password = await this.authenticationService.hash(createDto.password)

        try {
            const result = await this.repository.create({ ...createDto, password })
            if (result.status === 'conflict') {
                throw new ConflictException(UserErrors.EmailAlreadyExists(createDto.email))
            }
            return this.toDto(result.user)
        } catch (error) {
            if (isDuplicateKeyError(error)) {
                throw new ConflictException(UserErrors.EmailAlreadyExists(createDto.email))
            }
            throw error
        }
    }

    async deleteMany(userIds: string[]): Promise<void> {
        // DB 상태를 먼저 한 번에 비활성화해 Redis 회수 실패나 동시 refresh에도 기존 JWT가 즉시 거부되게 한다.
        await this.repository.deleteByIdsWithAuthVersion(userIds)
        await Promise.all(userIds.map((id) => this.authenticationService.revokeAllForUser(id)))
    }

    async login(credentials: UserCredentialsDto) {
        const user = await this.authenticationService.findUserByCredentials(credentials)
        if (!user) return null

        const tokens = await this.authenticationService.generateAuthTokens({
            authVersion: (user as { authVersion?: number }).authVersion ?? 0,
            email: user.email,
            sub: user.id
        })
        return { tokens, user: this.toDto(user) }
    }

    async getMany(userIds: string[]) {
        const users = await this.repository.getByIds(userIds)

        return this.toDtos(users)
    }

    async isAuthPayloadActive(payload: unknown): Promise<boolean> {
        return this.authenticationService.isAuthPayloadActive(payload)
    }

    async refreshAuthTokens(refreshToken: string) {
        return this.authenticationService.refreshAuthTokens(refreshToken)
    }

    async revokeAllForUser(userId: string): Promise<void> {
        // 버전을 먼저 올려 refresh 발급과 Redis 회수가 엇갈려도 그 토큰이 현재 계정과 일치하지 않게 한다.
        await this.repository.advanceAuthVersion(userId)
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
        if (patch.password !== undefined) {
            patch.password = await this.authenticationService.hash(patch.password)
        }

        try {
            const user = await this.repository.update(userId, patch)
            // 비밀번호가 바뀌면 기존 리프레시 토큰 묶음은 더 이상 신뢰할 수 없으므로 함께 회수한다.
            if (patch.password !== undefined) {
                await this.authenticationService.revokeAllForUser(userId)
            }
            return this.toDto(user)
        } catch (error) {
            if (isDuplicateKeyError(error) && updateDto.email) {
                throw new ConflictException(UserErrors.EmailAlreadyExists(updateDto.email))
            }
            throw error
        }
    }

    private toDto(user: User) {
        return ensure(this.toDtos([user])[0])
    }

    private toDtos(users: User[]) {
        return users.map((user) => mapDocToDto(user, UserDto, ['id', 'name', 'email', 'birthDate']))
    }
}
