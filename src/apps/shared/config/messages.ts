import { createMessagePatternMap, getProjectId } from './utils'

export const Messages = createMessagePatternMap(
    {
        StorageFiles: { saveFiles: null, getFiles: null, deleteFiles: null },
        Payments: { createPayment: null, getPayments: null },
        WatchRecords: { createWatchRecord: null, searchWatchRecordsPage: null },
        Tickets: {
            createTickets: null,
            updateTicketsStatus: null,
            searchTickets: null,
            aggregateTicketSales: null,
            getTickets: null
        },
        TicketHolding: { holdTickets: null, searchHeldTicketIds: null, releaseTickets: null },
        Theaters: {
            createTheater: null,
            updateTheater: null,
            getTheaters: null,
            deleteTheaters: null,
            searchTheatersPage: null,
            theatersExist: null
        },
        Showtimes: {
            createShowtimes: null,
            getShowtimes: null,
            searchShowtimes: null,
            searchMovieIds: null,
            searchTheaterIds: null,
            searchShowdates: null,
            allShowtimesExist: null
        },
        Purchases: { createPurchaseRecord: null, getPurchases: null },
        Movies: {
            createMovieDraft: null,
            presignMovieAsset: null,
            finalizeMovieAsset: null,
            finalizeMovieDraft: null,
            createMovie: null,
            updateMovie: null,
            getMovies: null,
            deleteMovies: null,
            searchMoviesPage: null,
            moviesExist: null
        },
        Customers: {
            createCustomer: null,
            updateCustomer: null,
            getCustomers: null,
            deleteCustomers: null,
            searchCustomersPage: null,
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
