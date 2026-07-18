import { ensure, isDuplicateKeyError, mapDocToDto } from '@mannercode/common'
import { ConflictException, Injectable } from '@nestjs/common'
import {
    CreateUserDto,
    UserAuthPayload,
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
            const newUser = await this.repository.create({ ...createDto, password })
            return this.toDto(newUser)
        } catch (error) {
            if (isDuplicateKeyError(error)) {
                throw new ConflictException(UserErrors.EmailAlreadyExists(createDto.email))
            }
            throw error
        }
    }

    async deleteMany(userIds: string[]): Promise<void> {
        // 삭제된 사용자가 살아 있는 리프레시 토큰으로 인증을 유지하지 못하도록 세션부터 회수한다.
        await Promise.all(userIds.map((id) => this.authenticationService.revokeAllForUser(id)))
        await this.repository.deleteByIds(userIds)
    }

    async findUserByCredentials(credentials: UserCredentialsDto) {
        const user = await this.authenticationService.findUserByCredentials(credentials)

        return user ? this.toDto(user) : null
    }

    async generateAuthTokens(payload: UserAuthPayload) {
        return this.authenticationService.generateAuthTokens(payload)
    }

    async getMany(userIds: string[]) {
        const users = await this.repository.getByIds(userIds)

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
