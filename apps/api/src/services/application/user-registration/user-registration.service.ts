import { ensure } from '@mannercode/common'
import { Injectable, OnModuleDestroy, UnprocessableEntityException } from '@nestjs/common'
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule'
import { UsersService } from '#core'
import { AssetsService } from '#infrastructure'
import {
    CreateRegistrationPhotoSchema,
    RegisterUserSchema,
    type RegisterUserDto,
    type CreateRegistrationPhotoDto
} from './dtos.js'
import { RegistrationErrors } from './errors.js'
import { RegistrationTransactionRepository } from './registration-transaction.repository.js'

const PHOTO_CLEANUP_JOB = 'registration.cleanupExpiredPhotos'

@Injectable()
export class UserRegistrationService implements OnModuleDestroy {
    constructor(
        private readonly users: UsersService,
        private readonly assets: AssetsService,
        private readonly transaction: RegistrationTransactionRepository,
        private readonly scheduler: SchedulerRegistry
    ) {}

    async createPhotoUpload(input: CreateRegistrationPhotoDto) {
        return this.assets.create(CreateRegistrationPhotoSchema.parse(input))
    }

    async register(input: RegisterUserDto) {
        const { photoAssetId, ...user } = RegisterUserSchema.parse(input)
        if (!photoAssetId) return this.users.create(user)
        if (!(await this.assets.isUploadComplete(photoAssetId))) {
            throw new UnprocessableEntityException(RegistrationErrors.PhotoIncomplete(photoAssetId))
        }

        // 계정과 사진 소유권을 함께 확정한다. 만료 정리와 다른 가입 요청도 같은 자산 쓰기와 경합한다.
        return this.transaction.withTransaction(async (transaction) => {
            const created = await this.users.create(user, photoAssetId, transaction)
            await this.assets.finalizeUpload(
                photoAssetId,
                { owner: { service: 'users', entityId: created.id } },
                transaction
            )
            return created
        })
    }

    async deleteUser(userId: string) {
        const user = ensure((await this.users.getMany([userId]))[0])
        if (user.photoAssetId) await this.assets.deleteMany([user.photoAssetId])
        await this.users.deleteMany([userId])
    }

    @Cron(CronExpression.EVERY_10_MINUTES, { name: PHOTO_CLEANUP_JOB, waitForCompletion: true })
    async cleanupExpiredPhotos() {
        await this.assets.cleanupExpiredUploads()
    }

    onModuleDestroy() {
        // 스케줄러의 종료 훅은 저장소 연결이 닫힌 뒤 실행된다.
        return this.scheduler.getCronJobs().get(PHOTO_CLEANUP_JOB)?.stop()
    }
}
