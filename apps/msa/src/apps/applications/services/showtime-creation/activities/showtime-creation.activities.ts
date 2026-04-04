import type { ShowtimesClient, TicketsClient } from 'apps/cores'
import { log } from '@temporalio/activity'
import type { BulkCreateShowtimesDto } from '../dtos'
import type {
    ShowtimeBulkCreatorService,
    ShowtimeBulkValidatorService,
    ShowtimeCreationEvent
} from '../services'
import type { ShowtimeCreationEvents } from '../showtime-creation.events'

export interface ShowtimeCreationActivities {
    emitStatusChanged(payload: ShowtimeCreationEvent): Promise<void>
    validateShowtimes(
        createDto: BulkCreateShowtimesDto
    ): Promise<{ isValid: boolean; conflictingShowtimes: any[] }>
    createShowtimes(
        createDto: BulkCreateShowtimesDto,
        sagaId: string
    ): Promise<{ createdShowtimeCount: number; createdTicketCount: number }>
    compensateShowtimeCreation(sagaId: string): Promise<void>
}

export function createShowtimeCreationActivities(deps: {
    validatorService: ShowtimeBulkValidatorService
    creatorService: ShowtimeBulkCreatorService
    events: ShowtimeCreationEvents
    showtimesClient: ShowtimesClient
    ticketsClient: TicketsClient
}): ShowtimeCreationActivities {
    return {
        async emitStatusChanged(payload) {
            log.info('emitStatusChanged', { sagaId: payload.sagaId, status: payload.status })
            await deps.events.emitStatusChanged(payload)
        },

        async validateShowtimes(createDto) {
            log.info('validateShowtimes', {
                movieId: createDto.movieId,
                theaterCount: createDto.theaterIds.length
            })
            return deps.validatorService.validate(createDto)
        },

        async createShowtimes(createDto, sagaId) {
            log.info('createShowtimes', { sagaId, movieId: createDto.movieId })
            return deps.creatorService.create(createDto, sagaId)
        },

        async compensateShowtimeCreation(sagaId) {
            log.warn('compensateShowtimeCreation', { sagaId })
            const results = await Promise.allSettled([
                deps.ticketsClient.deleteBySagaIds([sagaId]),
                deps.showtimesClient.deleteBySagaIds([sagaId])
            ])
            log.warn('compensateShowtimeCreation completed', {
                sagaId,
                tickets: results[0].status,
                showtimes: results[1].status
            })
        }
    }
}
