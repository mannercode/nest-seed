import { isDuplicateKeyError, mapDocToDto } from '@mannercode/common'
import { ConflictException, Injectable } from '@nestjs/common'
import { AdminsRepository } from './admins.repository.js'
import { AdminCredentialsDto, AdminDto, CreateAdminDto, UpdateAdminDto } from './dtos/index.js'
import { AdminErrors } from './errors.js'
import { AdminAuthenticationService } from './internal/index.js'
import { Admin } from './models/index.js'

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
        const patch = { ...updateDto }
        if (typeof patch.password === 'string') {
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
        // DB 상태를 먼저 비활성화해 Redis 회수 실패나 동시 refresh에도 기존 JWT가 즉시 거부되게 한다.
        await this.repository.deleteByIdWithAuthVersion(id)
        await this.authenticationService.revokeAllForAdmin(id)
    }

    async login(credentials: AdminCredentialsDto) {
        const admin = await this.authenticationService.findAdminByCredentials(credentials)
        if (!admin) return null

        const tokens = await this.authenticationService.generateAuthTokens({
            authVersion: (admin as { authVersion?: number }).authVersion ?? 0,
            email: admin.email,
            sub: admin.id
        })
        return { admin: this.toDto(admin), tokens }
    }

    async getMany(adminIds: string[]) {
        const admins = await this.repository.getByIds(adminIds)
        return admins.map((admin) => this.toDto(admin))
    }

    async isAuthPayloadActive(payload: unknown): Promise<boolean> {
        return this.authenticationService.isAuthPayloadActive(payload)
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
