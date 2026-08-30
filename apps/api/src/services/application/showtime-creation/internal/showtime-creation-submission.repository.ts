import {
    CrudRepository,
    DateUtil,
    ensure,
    isDuplicateKeyError,
    mongoToPublic,
    newObjectIdString,
    objectId
} from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { AppConfigService, MongoConnection } from '#config'
import { ShowtimeCreationSubmission } from './models/index.js'

export type ShowtimeCreationSubmissionClaim =
    | { claimId: string; kind: 'acquired'; sagaId: string }
    | { kind: 'accepted'; sagaId: string }
    | { kind: 'in-progress' }
    | { kind: 'key-reused' }

@Injectable()
export class ShowtimeCreationSubmissionRepository extends CrudRepository<ShowtimeCreationSubmission> {
    constructor(connection: MongoConnection, config: AppConfigService) {
        super(
            connection.db.collection('showtimecreationsubmissions'),
            connection.client,
            config.http.paginationDefaultSize,
            config.http.paginationMaxSize,
            {
                hardDelete: true,
                indexes: [
                    {
                        key: { principalId: 1, idempotencyKey: 1 },
                        name: 'principal_idempotency_key_unique',
                        unique: true
                    },
                    { key: { sagaId: 1 }, unique: true }
                ]
            }
        )
    }

    async acquire(
        principalId: string,
        idempotencyKey: string,
        inputHash: string,
        now: Temporal.Instant,
        claimUntil: Temporal.Instant
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
            await this.insertOne(submission)
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
        if (existing.claimUntil && DateUtil.isBefore(now, existing.claimUntil)) {
            return { kind: 'in-progress' }
        }

        // 이전 서버가 Restate 제출 결과를 기록하기 전에 종료됐다면 같은 saga ID로 이어받는다.
        // 같은 workflow key의 재제출은 기존 invocation을 가리키므로 실행은 하나만 유지된다.
        const claimed = await this.collection.findOneAndUpdate(
            this.activeFilter({
                _id: objectId(existing.id),
                acceptedAt: null,
                claimUntil: { $lte: now },
                inputHash,
                principalId
            }),
            this.timestamped({ $set: { claimId, claimUntil } }),
            { returnDocument: 'after' }
        )

        return claimed
            ? { claimId, kind: 'acquired', sagaId: existing.sagaId }
            : { kind: 'in-progress' }
    }

    async markAccepted(
        principalId: string,
        idempotencyKey: string,
        claimId: string,
        acceptedAt: Temporal.Instant
    ) {
        const submission = await this.collection.findOneAndUpdate(
            this.activeFilter({ acceptedAt: null, claimId, idempotencyKey, principalId }),
            this.timestamped({ $set: { acceptedAt, claimId: null, claimUntil: null } }),
            { returnDocument: 'after' }
        )

        return mongoToPublic<ShowtimeCreationSubmission>(submission)
    }

    async release(principalId: string, idempotencyKey: string, claimId: string) {
        await this.collection.updateOne(
            this.activeFilter({ acceptedAt: null, claimId, idempotencyKey, principalId }),
            this.timestamped({ $set: { claimId: null, claimUntil: DateUtil.epoch() } })
        )
    }

    async findByKey(principalId: string, idempotencyKey: string) {
        const submission = await this.collection.findOne({ idempotencyKey, principalId })
        return mongoToPublic<ShowtimeCreationSubmission>(submission)
    }
}
