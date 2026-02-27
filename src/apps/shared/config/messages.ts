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
        Booking: {
            getTickets: null,
            holdTickets: null,
            searchShowdates: null,
            searchShowtimes: null,
            searchTheaters: null
        },
        Customers: {
            create: null,
            deleteMany: null,
            findCustomerByCredentials: null,
            generateAuthTokens: null,
            getMany: null,
            refreshAuthTokens: null,
            searchPage: null,
            update: null
        },
        Movies: {
            Assets: { create: null, delete: null, finalizeUpload: null },
            create: null,
            deleteMany: null,
            allExist: null,
            getMany: null,
            publish: null,
            searchPage: null,
            update: null
        },
        Payments: { cancel: null, create: null, getMany: null },
        Purchase: { processPurchase: null },
        PurchaseRecords: { create: null, delete: null, getMany: null },
        Recommendation: { searchRecommendedMovies: null },
        ShowtimeCreation: {
            requestShowtimeCreation: null,
            searchMoviesPage: null,
            searchShowtimes: null,
            searchTheatersPage: null
        },
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
        Theaters: {
            create: null,
            deleteMany: null,
            allExist: null,
            getMany: null,
            searchPage: null,
            update: null
        },
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
