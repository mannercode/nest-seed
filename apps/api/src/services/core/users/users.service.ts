import { isDuplicateKeyError, mapDocToDto } from '@mannercode/common'
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

/**
 * 인증 세부 구현은 `UserAuthenticationService`에 두되, 외부 진입점은
 * `UsersService`로 유지합니다. 컨트롤러가 이 facade만 의존하면 사용자 도메인의
 * 공개 API가 한곳에 모이고, 인증 구현을 교체해도 컨트롤러 계층은 바뀌지 않습니다.
 */
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
        try {
            const user = await this.repository.update(userId, updateDto)
            return this.toDto(user)
        } catch (error) {
            if (isDuplicateKeyError(error) && updateDto.email) {
                throw new ConflictException(UserErrors.EmailAlreadyExists(updateDto.email))
            }
            throw error
        }
    }

    private toDto(user: User) {
        return this.toDtos([user])[0]
    }

    private toDtos(users: User[]) {
        return users.map((user) => mapDocToDto(user, UserDto, ['id', 'name', 'email', 'birthDate']))
    }
}
