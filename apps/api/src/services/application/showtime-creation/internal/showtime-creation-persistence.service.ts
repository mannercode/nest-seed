import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { TheatersService } from '#core'
import type { BulkCreateShowtimesDto } from '../dtos/index.js'
import type { ValidateAndCreateResult } from './types.js'
import { ShowtimeCreationErrors } from '../errors.js'
import { ShowtimeBulkCreatorService } from './showtime-bulk-creator.service.js'
import { ShowtimeBulkValidatorService } from './showtime-bulk-validator.service.js'
import { fingerprintShowtimeCreation } from './showtime-creation-fingerprint.js'
import { ShowtimeCreationOperationRepository } from './showtime-creation-operation.repository.js'

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

        return this.operations.runTransaction(async (transaction) => {
            const completed = await this.operations.findBySagaId({ sagaId, transaction, signal })
            if (completed) {
                this.assertSameInput(sagaId, inputHash, completed.inputHash)
                return completed.result
            }

            // 같은 극장의 생성 요청이 동시에 검증을 통과하지 않도록 조회 전에 잠금을 획득한다.
            const guardsAcquired = await this.theatersService.acquireShowtimeScheduleGuards(
                createDto.theaterIds,
                transaction,
                signal
            )
            if (!guardsAcquired) {
                throw new NotFoundException(
                    ShowtimeCreationErrors.TheatersNotFound(createDto.theaterIds)
                )
            }

            const { conflictingShowtimes, isValid } = await this.validatorService.validate(
                createDto,
                transaction,
                signal
            )
            const result: ValidateAndCreateResult = isValid
                ? {
                      kind: 'succeeded',
                      ...(await this.creatorService.create(createDto, sagaId, transaction, signal))
                  }
                : { conflictingShowtimes, kind: 'failed' }

            await this.operations.create(sagaId, inputHash, result, transaction, signal)
            return result
        })
    }

    private assertSameInput(sagaId: string, expectedHash: string, actualHash: string) {
        if (expectedHash !== actualHash) {
            throw new Error(`Saga ID was reused with different input (sagaId=${sagaId})`)
        }
    }
}
