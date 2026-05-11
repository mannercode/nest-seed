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
 * `findUserByCredentials` 와 `refreshAuthTokens` 는 `UserAuthenticationService`
 * 의 같은 이름 메서드를 그대로 다시 부른다. 얼핏 보면 군더더기처럼 보이지만,
 * 외부에 노출되는 모든 기능은 `UsersService` 만 거치도록 한다는 원칙을
 * 지키기 위해서다. 컨트롤러는 `UsersService` 만 참조하고,
 * `UserAuthenticationService` 를 직접 부르지 않는다.
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
