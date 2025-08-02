import { createMessagePatternMap, getProjectId } from './utils'

export const Events = createMessagePatternMap(
    {
        ShowtimeCreation: { statusChanged: null },
        PurchaseProcess: { TicketPurchased: null, TicketPurchaseCanceled: null }
    },
    `${getProjectId()}.event`
)
