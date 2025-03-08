import { BadRequestException, Logger } from '@nestjs/common'
import { DateUtil } from 'common'
import { ApplicationsErrors } from 'applications/application-errors'

const PURCHASE_MAX_TICKETS = 10
const PURCHASE_DEADLINE_MINUTES = 30

export function checkMaxTicketsForPurchase(ticketCount: number) {
    if (PURCHASE_MAX_TICKETS < ticketCount) {
        throw new BadRequestException({
            ...ApplicationsErrors.Purchase.MaxTicketsExceeded,
            maxCount: PURCHASE_MAX_TICKETS
        })
    }
}

export function checkPurchaseDeadline(startTime: Date) {
    const cutoffTime = DateUtil.addMinutes(new Date(), PURCHASE_DEADLINE_MINUTES)

    if (startTime.getTime() < cutoffTime.getTime()) {
        Logger.error(startTime.toLocaleTimeString(), cutoffTime.toLocaleTimeString())

        throw new BadRequestException({
            ...ApplicationsErrors.Purchase.DeadlineExceeded,
            deadlineMinutes: PURCHASE_DEADLINE_MINUTES
        })
    }
}

export function checkHeldTickets(heldTicketIds: string[], purchaseTicketIds: string[]) {
    const isAllExist = purchaseTicketIds.every((ticketId) => heldTicketIds.includes(ticketId))

    if (!isAllExist) {
        throw new BadRequestException(ApplicationsErrors.Purchase.TicketNotHeld)
    }
}
