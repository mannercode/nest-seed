import { mapDocToDto } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { AdminsRepository } from './admins.repository'
import { AdminAuthPayload, AdminCredentialsDto, AdminDto, CreateAdminDto } from './dtos'
import { AdminAuthenticationService } from './internal'
import { Admin } from './models'

// admin은 외부 가입 엔드포인트 없이 dev seed로만 생성된다. unique 위반은
// 호출자(`bootstrap.ts`)가 mongoose의 duplicate-key 신호를 보고 무시하므로
// 이 서비스는 변환 없이 그대로 propagate한다.
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
