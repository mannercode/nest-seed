import { mapDocToDto } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { AdminsRepository } from './admins.repository.js'
import {
    AdminCredentialsDto,
    AdminDto,
    CreateAdminDto,
    UpdateAdminDto,
    AdminSchema
} from './dtos/index.js'
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

        const created = await this.repository.create({ ...createDto, password })
        return this.toDto(created)
    }

    async update(id: string, updateDto: UpdateAdminDto) {
        const patch = { ...updateDto }
        if (typeof patch.password === 'string') {
            patch.password = await this.authenticationService.hash(patch.password)
        }

        const updated = await this.repository.update(id, patch)
        // 비밀번호가 바뀌면 기존 리프레시 토큰 묶음은 더 이상 신뢰할 수 없으므로 함께 회수한다.
        if (patch.password !== undefined) {
            await this.authenticationService.revokeAllForAdmin(id)
        }
        return this.toDto(updated)
    }

    async remove(id: string) {
        await this.repository.delete({ id })
        await this.authenticationService.revokeAllForAdmin(id)
    }

    async login(credentials: AdminCredentialsDto) {
        const admin = await this.authenticationService.authenticate(credentials)
        if (!admin) return null

        const tokens = await this.authenticationService.generateAuthTokens({
            email: admin.email,
            sub: admin.id
        })
        return { admin: this.toDto(admin), tokens }
    }

    async getMany(adminIds: string[]) {
        const admins = await this.repository.getMany({ ids: adminIds })
        return admins.map((admin) => this.toDto(admin))
    }

    async refreshAuthTokens(refreshToken: string) {
        return this.authenticationService.refreshAuthTokens(refreshToken)
    }

    async revokeRefreshToken(refreshToken: string) {
        return this.authenticationService.revokeRefreshToken(refreshToken)
    }

    private toDto(admin: Admin): AdminDto {
        return mapDocToDto(admin, AdminSchema)
    }
}
