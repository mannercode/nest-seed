import type { Model } from 'mongoose'
import {
    CrudRepository,
    ensure,
    isDuplicateKeyError,
    leanOneToPublic,
    newObjectIdString
} from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { AppConfigService, MONGO_CONNECTION_NAME } from 'config'
import { randomUUID } from 'node:crypto'
import { ShowtimeCreationSubmission } from './models'

export type ShowtimeCreationSubmissionClaim =
    | { claimId: string; kind: 'acquired'; sagaId: string }
    | { kind: 'accepted'; sagaId: string }
    | { kind: 'in-progress' }
    | { kind: 'key-reused' }

@Injectable()
export class ShowtimeCreationSubmissionRepository extends CrudRepository<ShowtimeCreationSubmission> {
    constructor(
        @InjectModel(ShowtimeCreationSubmission.name, MONGO_CONNECTION_NAME)
        readonly model: Model<ShowtimeCreationSubmission>,
        config: AppConfigService
    ) {
        super(model, config.http.paginationDefaultSize, config.http.paginationMaxSize)
    }

    async acquire(
        principalId: string,
        idempotencyKey: string,
        inputHash: string,
        now: Date,
        claimUntil: Date
    ): Promise<ShowtimeCreationSubmissionClaim> {
        const claimId = randomUUID()
        const sagaId = newObjectIdString()
        const submission = this.newDocument()
        submission.acceptedAt = null
        submission.claimId = claimId
        submission.claimUntil = claimUntil
        submission.idempotencyKey = idempotencyKey
        submission.inputHash = inputHash
        submission.principalId = principalId
        submission.sagaId = sagaId

        try {
            await submission.save()
            return { claimId, kind: 'acquired', sagaId }
        } catch (error) {
            if (!isDuplicateKeyError(error)) throw error
        }

        // 고유 키 충돌은 같은 principal+key 행이 이미 존재한다는 뜻이다. 행이 없다면
        // 성공으로 추정하지 않고 저장소 불변식 위반으로 처리한다.
        const existing = ensure(
            await this.findByKey(principalId, idempotencyKey),
            'Idempotency submission disappeared after a duplicate-key conflict.'
        )
        if (existing.inputHash !== inputHash) return { kind: 'key-reused' }
        if (existing.acceptedAt) return { kind: 'accepted', sagaId: existing.sagaId }
        if (existing.claimUntil && now < existing.claimUntil) return { kind: 'in-progress' }

        // 이전 서버가 Restate 제출 결과를 기록하기 전에 종료됐다면 같은 saga ID로 이어받는다.
        // 같은 workflow key의 재제출은 기존 invocation을 가리키므로 실행은 하나만 유지된다.
        const claimed = await this.model
            .findOneAndUpdate(
                {
                    _id: existing.id,
                    acceptedAt: null,
                    claimUntil: { $lte: now },
                    inputHash,
                    principalId
                },
                { $set: { claimId, claimUntil } },
                { returnDocument: 'after' }
            )
            .lean()
            .exec()

        return claimed
            ? { claimId, kind: 'acquired', sagaId: existing.sagaId }
            : { kind: 'in-progress' }
    }

    async markAccepted(
        principalId: string,
        idempotencyKey: string,
        claimId: string,
        acceptedAt: Date
    ) {
        const submission = await this.model
            .findOneAndUpdate(
                { acceptedAt: null, claimId, idempotencyKey, principalId },
                { $set: { acceptedAt, claimId: null, claimUntil: null } },
                { returnDocument: 'after' }
            )
            .lean()
            .exec()

        return leanOneToPublic<ShowtimeCreationSubmission>(submission)
    }

    async release(principalId: string, idempotencyKey: string, claimId: string) {
        await this.model
            .updateOne(
                { acceptedAt: null, claimId, idempotencyKey, principalId },
                { $set: { claimId: null, claimUntil: new Date(0) } }
            )
            .exec()
    }

    async findByKey(principalId: string, idempotencyKey: string) {
        const submission = await this.model.findOne({ idempotencyKey, principalId }).lean().exec()
        return leanOneToPublic<ShowtimeCreationSubmission>(submission)
    }
}
