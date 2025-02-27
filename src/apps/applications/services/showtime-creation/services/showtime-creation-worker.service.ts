import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { Job, Queue } from 'bullmq'
import { ClientProxyService, DateUtil, InjectClientProxy, jsonToObject, MethodLog } from 'common'
import {
    Seatmap,
    ShowtimeDto,
    ShowtimesProxy,
    TheaterDto,
    TheatersProxy,
    TicketsProxy,
    TicketStatus
} from 'cores'
import { ClientProxyConfig, Events } from 'shared/config'
import { ShowtimeBatchCreateStatus } from '../dtos'
import { ShowtimeCreationValidatorService } from './showtime-creation-validator.service'
import { ShowtimeBatchCreateJobData } from './types'

@Injectable()
@Processor('showtime-creation')
export class ShowtimeCreationWorkerService extends WorkerHost {
    constructor(
        private theatersService: TheatersProxy,
        private showtimesService: ShowtimesProxy,
        private ticketsService: TicketsProxy,
        private validatorService: ShowtimeCreationValidatorService,
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService,
        @InjectQueue('showtime-creation') private queue: Queue
    ) {
        super()
    }

    async enqueueTask(data: ShowtimeBatchCreateJobData) {
        this.emit({ status: ShowtimeBatchCreateStatus.waiting, batchId: data.batchId })

        await this.queue.add('showtime-creation.create', data)
    }

    async process(job: Job<ShowtimeBatchCreateJobData>) {
        try {
            await this.executeShowtimesCreation(jsonToObject(job.data))
        } catch (error) {
            this.emit({
                status: ShowtimeBatchCreateStatus.error,
                batchId: job.data.batchId,
                message: error.message
            })
        }
    }

    @MethodLog()
    private async executeShowtimesCreation(data: ShowtimeBatchCreateJobData) {
        this.emit({ status: ShowtimeBatchCreateStatus.processing, batchId: data.batchId })

        const conflictingShowtimes = await this.validatorService.validate(data)

        if (conflictingShowtimes.length > 0) {
            this.emit({
                status: ShowtimeBatchCreateStatus.fail,
                batchId: data.batchId,
                conflictingShowtimes
            })
        } else {
            const createdShowtimes = await this.createShowtimes(data)
            const ticketCreatedCount = await this.createTickets(createdShowtimes, data.batchId)

            this.emit({
                status: ShowtimeBatchCreateStatus.complete,
                batchId: data.batchId,
                showtimeCreatedCount: createdShowtimes.length,
                ticketCreatedCount
            })
        }
    }

    private emit(payload: any) {
        this.service.emit(Events.ShowtimeCreation.statusChanged, payload)
    }

    private async createShowtimes(data: ShowtimeBatchCreateJobData) {
        const { batchId, movieId, theaterIds, durationMinutes, startTimes } = data

        const createDtos = theaterIds.flatMap((theaterId) =>
            startTimes.map((startTime) => ({
                batchId,
                movieId,
                theaterId,
                startTime,
                endTime: DateUtil.addMinutes(startTime, durationMinutes)
            }))
        )

        await this.showtimesService.createShowtimes(createDtos)
        const showtimes = await this.showtimesService.findAllShowtimes({ batchIds: [batchId] })
        return showtimes
    }

    private async createTickets(showtimes: ShowtimeDto[], batchId: string) {
        let totalCount = 0

        const theaterMap: Map<string, TheaterDto> = new Map()

        await Promise.all(
            showtimes.map(async (showtime) => {
                let theater = theaterMap.get(showtime.theaterId)

                if (!theater) {
                    theater = await this.theatersService.getTheater(showtime.theaterId)
                    theaterMap.set(showtime.theaterId, theater)
                }

                const ticketCreateDtos = Seatmap.getAllSeats(theater!.seatmap).map((seat) => ({
                    showtimeId: showtime.id,
                    theaterId: showtime.theaterId,
                    movieId: showtime.movieId,
                    status: TicketStatus.available,
                    seat,
                    batchId
                }))

                const { count } = await this.ticketsService.createTickets(ticketCreateDtos)
                totalCount += count
            })
        )

        return totalCount
    }
}
