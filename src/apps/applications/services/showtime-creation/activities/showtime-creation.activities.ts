import type { Json } from '@mannercode/nest-common'
import type { ShowtimesClient, TicketsClient } from 'apps/cores'
import type { BulkCreateShowtimesDto } from '../dtos'
import type { ShowtimeBulkCreatorService } from '../services/showtime-bulk-creator.service'
import type { ShowtimeBulkValidatorService } from '../services/showtime-bulk-validator.service'
import type { ShowtimeCreationEvent } from '../services/types'
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
    reviveIsoDates: typeof Json.reviveIsoDates
}): ShowtimeCreationActivities {
    return {
        async emitStatusChanged(payload) {
            await deps.events.emitStatusChanged(payload)
        },

        async validateShowtimes(createDto) {
            const revived = deps.reviveIsoDates(createDto) as BulkCreateShowtimesDto
            return deps.validatorService.validate(revived)
        },

        async createShowtimes(createDto, sagaId) {
            const revived = deps.reviveIsoDates(createDto) as BulkCreateShowtimesDto
            return deps.creatorService.create(revived, sagaId)
        },

        async compensateShowtimeCreation(sagaId) {
            await Promise.allSettled([
                deps.ticketsClient.deleteBySagaIds([sagaId]),
                deps.showtimesClient.deleteBySagaIds([sagaId])
            ])
        }
    }
}
