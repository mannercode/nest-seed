import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq'
import { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { Job, Queue } from 'bullmq'
import { newObjectIdString, reviveIsoDates } from 'common'
import { get } from 'lodash'
import { BulkCreateShowtimesDto } from '../dtos'
import { ShowtimeCreationEvents } from '../showtime-creation.events'
import { ShowtimeBulkCreatorService } from './showtime-bulk-creator.service'
import { ShowtimeBulkValidatorService } from './showtime-bulk-validator.service'
import { ShowtimeCreationJobData } from './types'
import { ShowtimeCreationStatus } from './types'

@Injectable()
@Processor('showtime-creation')
export class ShowtimeCreationWorkerService
    extends WorkerHost
    implements OnModuleDestroy, OnModuleInit
{
    constructor(
        private readonly validatorService: ShowtimeBulkValidatorService,
        private readonly creatorService: ShowtimeBulkCreatorService,
        private readonly events: ShowtimeCreationEvents,
        @InjectQueue('showtime-creation') private readonly queue: Queue
    ) {
        super()
    }

    async enqueueShowtimeCreationJob(createDto: BulkCreateShowtimesDto) {
        const sagaId = newObjectIdString()

        const jobData = { createDto, sagaId } as ShowtimeCreationJobData

        await this.events.emitStatusChanged({ sagaId, status: ShowtimeCreationStatus.Waiting })

        await this.queue.add('showtime-creation.create', jobData)

        return sagaId
    }

    async onModuleDestroy() {
        await this.worker.close()
    }

    async onModuleInit() {
        /**
         * When Redis is offline during onModuleInit, the BullMQ initialization tasks wait in the offlineQueue.
         * In this state, if onModuleDestroy is called before Redis comes online,
         * the tasks in the offlineQueue throw an 'Error: Connection is closed' error.
         * To address this, we use waitUntilReady so that the system waits until Redis is online.
         *
         * onModuleInit에서 Redis가 오프라인이면 BullMQ 초기화 작업이 offlineQueue에 대기한다.
         * 이 상태에서 Redis가 온라인 되기 전에 onModuleDestroy가 호출되면,
         * offlineQueue의 작업들이 'Error: Connection is closed' 오류를 던진다.
         * 이를 해결하기 위해 waitUntilReady로 Redis가 온라인 될 때까지 대기한다.
         */
        await this.worker.waitUntilReady()
    }

    async process(job: Job<ShowtimeCreationJobData>) {
        try {
            const jobData = reviveIsoDates(job.data)

            await this.processJobData(jobData)
        } catch (error: unknown) {
            const message = get(error, 'message', String(error))

            await this.events.emitStatusChanged({
                message,
                sagaId: job.data.sagaId,
                status: ShowtimeCreationStatus.Error
            })
        }
    }

    private async processJobData({ createDto, sagaId }: ShowtimeCreationJobData) {
        await this.events.emitStatusChanged({ sagaId, status: ShowtimeCreationStatus.Processing })

        const { conflictingShowtimes, isValid } = await this.validatorService.validate(createDto)

        if (isValid) {
            const creationResult = await this.creatorService.create(createDto, sagaId)

            await this.events.emitStatusChanged({
                sagaId,
                status: ShowtimeCreationStatus.Succeeded,
                ...creationResult
            })
        } else {
            await this.events.emitStatusChanged({
                conflictingShowtimes,
                sagaId,
                status: ShowtimeCreationStatus.Failed
            })
        }
    }
}
