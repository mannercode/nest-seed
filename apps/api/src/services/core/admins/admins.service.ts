import { mapDocToDto } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { AdminsRepository } from './admins.repository'
import {
    AdminAuthPayload,
    AdminCredentialsDto,
    AdminDto,
    CreateAdminDto,
    UpdateAdminDto
} from './dtos'
import { AdminAuthenticationService } from './internal'
import { Admin } from './models'

// admin 도큐먼트는 root가 `POST /admins`로 만들고 `DELETE /admins/:id`로 지운다.
// admin 자신은 `PATCH /admins/me`로 자기 정보를 수정한다.
// 같은 이메일을 다시 만들면 `findByEmailWithPassword`의 unique 인덱스가 E11000을 던지고
// HTTP 계층에서 ConflictException으로 변환된다.
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
        const patch: Partial<Pick<Admin, 'email' | 'name' | 'password'>> = {}
        if (updateDto.email !== undefined) patch.email = updateDto.email
        if (updateDto.name !== undefined) patch.name = updateDto.name
        if (updateDto.password !== undefined) {
            patch.password = await this.authenticationService.hash(updateDto.password)
        }

        const updated = await this.repository.updateById(id, patch)
        return updated ? this.toDto(updated) : null
    }

    async remove(id: string) {
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
