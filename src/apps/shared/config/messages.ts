import { createMessagePatternMap, getProjectId } from './utils'

export const Messages = createMessagePatternMap(
    {
        Assets: {
            getMany: null,
            deleteMany: null,
            create: null,
            finalizeUpload: null,
            isUploadComplete: null
        },
        Payments: { create: null, getMany: null },
        WatchRecords: { create: null, searchPage: null },
        Tickets: {
            createMany: null,
            updateStatusMany: null,
            deleteBySagaIds: null,
            search: null,
            aggregateSales: null,
            getMany: null
        },
        TicketHolding: { holdTickets: null, searchHeldTicketIds: null, releaseTickets: null },
        Theaters: {
            create: null,
            update: null,
            getMany: null,
            deleteMany: null,
            searchPage: null,
            existsAll: null
        },
        Showtimes: {
            createMany: null,
            getMany: null,
            deleteBySagaIds: null,
            search: null,
            searchMovieIds: null,
            searchTheaterIds: null,
            searchShowdates: null,
            existsAll: null
        },
        PurchaseRecords: { create: null, getMany: null },
        Movies: {
            create: null,
            publish: null,
            update: null,
            getMany: null,
            deleteMany: null,
            searchPage: null,
            existsAll: null,
            Assets: { create: null, delete: null, finalizeUpload: null }
        },
        Customers: {
            create: null,
            update: null,
            getMany: null,
            deleteMany: null,
            searchPage: null,
            generateAuthTokens: null,
            refreshAuthTokens: null,
            findCustomerByCredentials: null
        },
        ShowtimeCreation: {
            searchMoviesPage: null,
            searchTheatersPage: null,
            searchShowtimes: null,
            requestShowtimeCreation: null
        },
        Recommendation: { searchRecommendedMovies: null },
        Purchase: { processPurchase: null },
        Booking: {
            searchTheaters: null,
            searchShowdates: null,
            searchShowtimes: null,
            getTickets: null,
            holdTickets: null
        }
    },
    `${getProjectId()}.message`
)
