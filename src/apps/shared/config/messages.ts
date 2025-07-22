import { createMessagePatternMap, getProjectId } from './utils'

export const Messages = createMessagePatternMap(
    {
        StorageFiles: {
            saveFiles: null,
            getFiles: null,
            deleteFiles: null
        },
        Payments: {
            processPayment: null,
            getPayments: null
        },
        WatchRecords: {
            createWatchRecord: null,
            searchWatchRecordsPage: null
        },
        Tickets: {
            createTickets: null,
            updateTicketStatus: null,
            searchTickets: null,
            getTicketSalesForShowtimes: null,
            getTickets: null
        },
        TicketHolding: {
            holdTickets: null,
            searchHeldTicketIds: null,
            releaseTickets: null
        },
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
            searchShowingMovieIds: null,
            searchTheaterIds: null,
            searchShowdates: null,
            allShowtimesExist: null
        },
        Purchases: {
            createPurchase: null,
            getPurchases: null
        },
        Movies: {
            createMovie: null,
            updateMovie: null,
            getMovies: null,
            deleteMovies: null,
            searchMoviesPage: null,
            getMoviesByIds: null,
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
        Recommendation: {
            searchRecommendedMovies: null
        },
        PurchaseProcess: {
            processPurchase: null
        },
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
