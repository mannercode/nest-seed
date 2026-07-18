import { isDuplicateKeyError, mapDocToDto } from '@mannercode/common'
import { ConflictException, Injectable } from '@nestjs/common'
import { AdminsRepository } from './admins.repository'
import {
    AdminAuthPayload,
    AdminCredentialsDto,
    AdminDto,
    CreateAdminDto,
    UpdateAdminDto
} from './dtos'
import { AdminErrors } from './errors'
import { AdminAuthenticationService } from './internal'
import { Admin } from './models'

@Injectable()
export class AdminsService {
    constructor(
        private readonly repository: AdminsRepository,
        private readonly authenticationService: AdminAuthenticationService
    ) {}

    async create(createDto: CreateAdminDto) {
        const password = await this.authenticationService.hash(createDto.password)

        try {
            const created = await this.repository.create({ ...createDto, password })
            return this.toDto(created)
        } catch (error) {
            if (isDuplicateKeyError(error)) {
                throw new ConflictException(AdminErrors.EmailAlreadyExists(createDto.email))
            }
            throw error
        }
    }

    async update(id: string, updateDto: UpdateAdminDto) {
        const patch: Partial<Pick<Admin, 'email' | 'name' | 'password'>> = { ...updateDto }
        if (patch.password !== undefined) {
            patch.password = await this.authenticationService.hash(patch.password)
        }

        try {
            const updated = await this.repository.update(id, patch)
            // 비밀번호가 바뀌면 기존 리프레시 토큰 묶음은 더 이상 신뢰할 수 없으므로 함께 회수한다.
            if (patch.password !== undefined) {
                await this.authenticationService.revokeAllForAdmin(id)
            }
            return this.toDto(updated)
        } catch (error) {
            if (isDuplicateKeyError(error) && updateDto.email) {
                throw new ConflictException(AdminErrors.EmailAlreadyExists(updateDto.email))
            }
            throw error
        }
    }

    async remove(id: string) {
        // 제거된 admin이 살아 있는 리프레시 토큰으로 권한을 유지하지 못하도록 세션부터 회수한다.
        await this.authenticationService.revokeAllForAdmin(id)
        await this.repository.deleteById(id)
    }

    async findAdminByCredentials(credentials: AdminCredentialsDto) {
        const admin = await this.authenticationService.findAdminByCredentials(credentials)
        return admin ? this.toDto(admin) : null
    }

    async generateAuthTokens(payload: AdminAuthPayload) {
        return this.authenticationService.generateAuthTokens(payload)
    }

    async getMany(adminIds: string[]) {
        const admins = await this.repository.getByIds(adminIds)
        return admins.map((admin) => this.toDto(admin))
    }

    async refreshAuthTokens(refreshToken: string) {
        return this.authenticationService.refreshAuthTokens(refreshToken)
    }

    async revokeRefreshToken(refreshToken: string) {
        return this.authenticationService.revokeRefreshToken(refreshToken)
    }

    private toDto(admin: Admin): AdminDto {
        return mapDocToDto(admin, AdminDto, ['id', 'email', 'name'])
    }
}
