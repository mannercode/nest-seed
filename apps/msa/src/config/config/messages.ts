import { createMessagePatternMap, getProjectId } from './utils'

export const Messages = createMessagePatternMap(
    {
        Assets: {
            create: null,
            deleteMany: null,
            finalizeUpload: null,
            getMany: null,
            isUploadComplete: null
        },
        Movies: { allExist: null, getMany: null, searchPage: null },
        Payments: { cancel: null, create: null, getMany: null },
        PurchaseRecords: { create: null, delete: null },
        Showtimes: {
            createMany: null,
            deleteBySagaIds: null,
            allExist: null,
            getMany: null,
            search: null,
            searchMovieIds: null,
            searchShowdates: null,
            searchTheaterIds: null
        },
        Theaters: { allExist: null, getMany: null, searchPage: null },
        TicketHolding: { holdTickets: null, releaseTickets: null, searchHeldTicketIds: null },
        Tickets: {
            aggregateSales: null,
            createMany: null,
            deleteBySagaIds: null,
            getMany: null,
            search: null,
            updateStatusMany: null
        },
        WatchRecords: { create: null, searchPage: null }
    },
    `${getProjectId()}.message`
)
