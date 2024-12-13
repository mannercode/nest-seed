import { Logger, BadRequestException } from '@nestjs/common'
import { addMinutes } from 'common'

const PURCHASE_MAX_TICKETS = 10
const PURCHASE_DEADLINE_MINUTES = 30

export function checkMaxTicketsForPurchase(ticketCount: number) {
    if (PURCHASE_MAX_TICKETS < ticketCount) {
        throw new BadRequestException({
            code: 'ERR_PURCHASE_MAX_TICKETS_EXCEEDED',
            message: `Customers can purchase up to ${PURCHASE_MAX_TICKETS} tickets at once.`,
            maxCount: PURCHASE_MAX_TICKETS
        })
    }
}

export function checkPurchaseDeadline(startTime: Date) {
    const cutoffTime = addMinutes(new Date(), PURCHASE_DEADLINE_MINUTES)

    if (startTime.getTime() < cutoffTime.getTime()) {
        Logger.error(startTime.toLocaleTimeString(), cutoffTime.toLocaleTimeString())

        throw new BadRequestException({
            code: 'ERR_PURCHASE_DEADLINE_EXCEEDED',
            message: `You can only purchase tickets online until ${PURCHASE_DEADLINE_MINUTES} minutes before the showtime.`,
            deadlineMinutes: PURCHASE_DEADLINE_MINUTES
        })
    }
}

export function checkHeldTickets(heldTicketIds: string[], purchaseTicketIds: string[]) {
    const isAllExist = purchaseTicketIds.every((ticketId) => heldTicketIds.includes(ticketId))

    if (!isAllExist) {
        throw new BadRequestException({
            code: 'ERR_TICKET_NOT_HELD',
            message: `Tickets must be held first.`
        })
    }
}
