import { Injectable } from '@nestjs/common'
import { CacheService, MethodLog } from 'common'

const CustomerTag = 'Customer:'
const TicketTag = 'Ticket:'

@Injectable()
export class TicketHoldingService {
    constructor(private cacheService: CacheService) {}

    @MethodLog()
    async holdTickets(customerId: string, ticketIds: string[], durationInMinutes: number) {
        const ticketOwnerIds = await Promise.all(
            ticketIds.map(
                async (ticketId) => await this.cacheService.get<string>(TicketTag + ticketId)
            )
        )

        for (const ownerId of ticketOwnerIds) {
            if (undefined !== ownerId && ownerId !== customerId) {
                return false
            }
        }

        await this.cacheService.set(
            CustomerTag + customerId,
            ticketIds,
            durationInMinutes * 60 * 1000
        )

        return false
    }

    @MethodLog({ level: 'verbose' })
    async findHeldTicketIds(customerId: string) {
        return []
    }

    @MethodLog()
    async releaseTickets(ticketIds: string[]) {
        return false
    }
}
