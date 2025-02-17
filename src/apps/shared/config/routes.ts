import { createRoutes, Environment } from 'common'
import { isTest } from './etc'

const Http = {
    // MoviesService에서 경로를 참조한다.
    StorageFiles: '/storage-files'
}

export const Routes = { Http }

export const Messages = createRoutes(
    {
        StorageFiles: {
            saveFiles: null,
            getStorageFile: null,
            deleteStorageFile: null
        },
        Payments: {
            processPayment: null,
            getPayment: null
        },
        WatchRecords: {
            createWatchRecord: null,
            findWatchRecords: null
        },
        Tickets: {
            createTickets: null,
            updateTicketStatus: null,
            findAllTickets: null,
            getSalesStatuses: null,
            getTickets: null
        },
        TicketHolding: {
            holdTickets: null,
            findHeldTicketIds: null,
            releaseTickets: null
        },
        Theaters: {
            createTheater: null,
            updateTheater: null,
            getTheater: null,
            deleteTheater: null,
            findTheaters: null,
            getTheatersByIds: null,
            theatersExist: null
        },
        Showtimes: {
            createShowtimes: null,
            getShowtimes: null,
            findAllShowtimes: null,
            findShowingMovieIds: null,
            findTheaterIdsByMovieId: null,
            findShowdates: null
        },
        Purchases: {
            createPurchase: null,
            getPurchase: null
        },
        Movies: {
            createMovie: null,
            updateMovie: null,
            getMovie: null,
            deleteMovie: null,
            findMovies: null,
            getMoviesByIds: null,
            moviesExist: null
        },
        Customers: {
            createCustomer: null,
            updateCustomer: null,
            getCustomer: null,
            deleteCustomer: null,
            findCustomers: null,
            login: null,
            refreshAuthTokens: null,
            authenticateCustomer: null
        },
        ShowtimeCreation: {
            findMovies: null,
            findTheaters: null,
            findShowtimes: null,
            createBatchShowtimes: null
        },
        Recommendation: {
            findRecommendedMovies: null
        },
        PurchaseProcess: {
            processPurchase: null
        },
        Booking: {
            findShowingTheaters: null,
            findShowdates: null,
            findShowtimes: null,
            getAvailableTickets: null,
            holdTickets: null
        }
    },
    isTest() ? Environment.getString('TEST_ID') : 'nest-seed'
)

// TODO 이거 하나로 합칠까? 충돌 가능성이 있을지도
export const Events = createRoutes(
    {
        ShowtimeCreation: {
            event: null
        }
    },
    isTest() ? Environment.getString('TEST_ID') : 'nest-seed'
)
