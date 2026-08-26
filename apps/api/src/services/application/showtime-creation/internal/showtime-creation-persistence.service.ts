import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { TheatersService } from 'core'
import type { BulkCreateShowtimesDto } from '../dtos'
import type { ValidateAndCreateResult } from './types'
import { ShowtimeCreationErrors } from '../errors'
import { ShowtimeBulkCreatorService } from './showtime-bulk-creator.service'
import { ShowtimeBulkValidatorService } from './showtime-bulk-validator.service'
import { fingerprintShowtimeCreation } from './showtime-creation-fingerprint'
import { ShowtimeCreationOperationRepository } from './showtime-creation-operation.repository'

const COMMIT_TIMEOUT_MS = 10_000
// MongoDB 드라이버의 transaction callback 재시도까지 Activity 한 시도 안에서 끝낸다.
// `maxCommitTimeMS`는 개별 commit 명령만 제한하므로 전체 transaction에는 별도 제한이 필요하다.
const TRANSACTION_TIMEOUT_MS = 45_000
const MAX_SHOWTIMES_PER_OPERATION = 200

@Injectable()
export class ShowtimeCreationPersistenceService {
    constructor(
        private readonly operations: ShowtimeCreationOperationRepository,
        private readonly theatersService: TheatersService,
        private readonly validatorService: ShowtimeBulkValidatorService,
        private readonly creatorService: ShowtimeBulkCreatorService
    ) {}

    async validateAndCreate(
        createDto: BulkCreateShowtimesDto,
        sagaId: string,
        signal: AbortSignal | undefined = undefined
    ): Promise<ValidateAndCreateResult> {
        const requestedShowtimeCount = createDto.theaterIds.length * createDto.startTimes.length
        if (MAX_SHOWTIMES_PER_OPERATION < requestedShowtimeCount) {
            throw new BadRequestException(
                ShowtimeCreationErrors.TooManyShowtimes(MAX_SHOWTIMES_PER_OPERATION)
            )
        }

        const inputHash = fingerprintShowtimeCreation(createDto)

        return this.operations.withTransaction(
            async (session) => {
                const completed = await this.operations.findBySagaId(sagaId, session, signal)
                if (completed) {
                    this.assertSameInput(sagaId, inputHash, completed.inputHash)
                    return completed.result
                }

                // 이 쓰기를 검증 조회보다 먼저 실행해야 같은 극장의 concurrent transaction이
                // 서로 다른 snapshot에서 둘 다 검증을 통과하지 않고 WriteConflict로 직렬화된다.
                const guardsAcquired = await this.theatersService.acquireShowtimeScheduleGuards(
                    createDto.theaterIds,
                    session,
                    signal
                )
                if (!guardsAcquired) {
                    throw new NotFoundException(
                        ShowtimeCreationErrors.TheatersNotFound(createDto.theaterIds)
                    )
                }

                const { conflictingShowtimes, isValid } = await this.validatorService.validate(
                    createDto,
                    session,
                    signal
                )
                const result: ValidateAndCreateResult = isValid
                    ? {
                          kind: 'succeeded',
                          ...(await this.creatorService.create(createDto, sagaId, session, signal))
                      }
                    : { conflictingShowtimes, kind: 'failed' }

                await this.operations.create(sagaId, inputHash, result, session, signal)
                return result
            },
            {
                maxCommitTimeMS: COMMIT_TIMEOUT_MS,
                readConcern: { level: 'snapshot' },
                timeoutMS: TRANSACTION_TIMEOUT_MS,
                writeConcern: { w: 'majority' }
            }
        )
    }

    private assertSameInput(sagaId: string, expectedHash: string, actualHash: string) {
        if (expectedHash !== actualHash) {
            throw new Error(`Saga ID was reused with different input (sagaId=${sagaId})`)
        }
    }
}
