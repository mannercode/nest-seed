import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq'
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Job, Queue } from 'bullmq'
import { jsonToObject, newObjectId } from 'common'
import { BulkCreateShowtimesDto } from '../dtos'
import { ShowtimeCreationEvents } from '../showtime-creation.events'
import { ShowtimeBulkCreatorService } from './showtime-bulk-creator.service'
import { ShowtimeBulkValidatorService } from './showtime-bulk-validator.service'
import { ShowtimeCreationJobData, ShowtimeCreationStatus } from './types'

@Injectable()
@Processor('showtime-creation')
export class ShowtimeCreationWorkerService
    extends WorkerHost
    implements OnModuleInit, OnModuleDestroy
{
    constructor(
        private readonly validatorService: ShowtimeBulkValidatorService,
        private readonly creatorService: ShowtimeBulkCreatorService,
        private readonly events: ShowtimeCreationEvents,
        @InjectQueue('showtime-creation') private readonly queue: Queue
    ) {
        super()
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

    async onModuleDestroy() {
        await this.worker.close()
    }

    async requestShowtimeCreation(createDto: BulkCreateShowtimesDto) {
        const sagaId = newObjectId()

        const jobData = { createDto, sagaId } as ShowtimeCreationJobData

        await this.events.emitStatusChanged({ status: ShowtimeCreationStatus.Waiting, sagaId })

        await this.queue.add('showtime-creation.create', jobData)

        return sagaId
    }

    async process(job: Job<ShowtimeCreationJobData>) {
        try {
            const jobData = jsonToObject(job.data)

            await this.processJobData(jobData)
        } catch (error) {
            await this.events.emitStatusChanged({
                status: ShowtimeCreationStatus.Error,
                sagaId: job.data.sagaId,
                message: error.message
            })
        }
    }

    private async processJobData({ sagaId, createDto }: ShowtimeCreationJobData) {
        await this.events.emitStatusChanged({ status: ShowtimeCreationStatus.Processing, sagaId })

        const { isValid, conflictingShowtimes } = await this.validatorService.validate(createDto)

        if (isValid) {
            const creationResult = await this.creatorService.create(createDto, sagaId)

            await this.events.emitStatusChanged({
                status: ShowtimeCreationStatus.Succeeded,
                sagaId,
                ...creationResult
            })
        } else {
            await this.events.emitStatusChanged({
                status: ShowtimeCreationStatus.Failed,
                sagaId,
                conflictingShowtimes
            })
        }
    }
}
