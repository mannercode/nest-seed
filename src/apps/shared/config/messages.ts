import { createMessagePatternMap, getProjectId } from './utils'

export const Messages = createMessagePatternMap(
    {
        StorageFiles: { saveFiles: null, getFiles: null, deleteFiles: null },
        Payments: { create: null, getMany: null },
        WatchRecords: { create: null, searchPage: null },
        Tickets: {
            createMany: null,
            updateStatusMany: null,
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
            exists: null
        },
        Showtimes: {
            createMany: null,
            getMany: null,
            search: null,
            searchMovieIds: null,
            searchTheaterIds: null,
            searchShowdates: null,
            exists: null
        },
        Purchases: { create: null, getMany: null },
        MovieDrafts: {
            create: null,
            update: null,
            get: null,
            delete: null
        },
        Movies: {
            create: null,
            update: null,
            getMany: null,
            deleteMany: null,
            searchPage: null,
            exists: null
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
