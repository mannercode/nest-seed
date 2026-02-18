import { createMessagePatternMap, getProjectId } from './utils'

export const Events = createMessagePatternMap(
    {
        ShowtimeCreation: { statusChanged: null },
        Purchase: { ticketPurchased: null, ticketPurchaseCanceled: null }
    },
    `${getProjectId()}.event`
)
