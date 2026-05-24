import { mapDocToDto } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { AdminsRepository } from './admins.repository'
import { AdminAuthPayload, AdminCredentialsDto, AdminDto, CreateAdminDto } from './dtos'
import { AdminAuthenticationService } from './internal'
import { Admin } from './models'

// admin은 가입 API 없이 개발용 초기 데이터로만 만든다. 같은 admin을 다시
// 만들 때 생기는 중복 오류는 `bootstrap.ts`가 무시하므로 여기서는 그대로 넘긴다.
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
