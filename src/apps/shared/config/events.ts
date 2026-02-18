import { createMessagePatternMap, getProjectId } from './utils'

export const Events = createMessagePatternMap(
    {
        Purchase: { ticketPurchaseCanceled: null, ticketPurchased: null },
        ShowtimeCreation: { statusChanged: null }
    },
    `${getProjectId()}.event`
)
