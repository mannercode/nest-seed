import { Injectable } from '@nestjs/common'
import { CacheService, MethodLog } from 'common'

const CustomerTag = 'Customer:'
const TicketTag = 'Ticket:'

@Injectable()
export class TicketHoldingService {
    constructor(private cacheService: CacheService) {}

    @MethodLog()
    async holdTickets(customerId: string, ticketIds: string[], holdDuration: number) {
        const ticketOwnerIds = await Promise.all(
            ticketIds.map(async (ticketId) => await this.cacheService.get(TicketTag + ticketId))
        )

        for (const ownerId of ticketOwnerIds) {
            if (ownerId && ownerId !== customerId) {
                return false
            }
        }

        await this.releaseAllTickets(customerId)

        await Promise.all(
            ticketIds.map(
                async (ticketId) =>
                    await this.cacheService.set(TicketTag + ticketId, customerId, holdDuration)
            )
        )

        await this.cacheService.set(CustomerTag + customerId, JSON.stringify(ticketIds), holdDuration)

        return true
    }

    @MethodLog({ level: 'verbose' })
    async findHeldTicketIds(customerId: string): Promise<string[]> {
        const tickets = await this.cacheService.get(CustomerTag + customerId)

        return tickets ? JSON.parse(tickets) : []
    }

    @MethodLog()
    async releaseAllTickets(customerId: string) {
        const tickets = await this.findHeldTicketIds(customerId)

        await Promise.all(
            tickets.map(async (ticketId) => await this.cacheService.delete(TicketTag + ticketId))
        )

        await this.cacheService.delete(CustomerTag + customerId)

        return true
    }
}
