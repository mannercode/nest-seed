import {
    BookingClient,
    PurchaseProcessClient,
    RecommendationClient,
    ShowtimeCreationClient
} from 'apps/applications'
import {
    CustomersClient,
    MoviesClient,
    PurchaseRecordsClient,
    ShowtimesClient,
    TheatersClient,
    TicketHoldingClient,
    TicketsClient,
    WatchRecordsClient
} from 'apps/cores'
import { PaymentsClient, StorageFilesClient } from 'apps/infrastructures'
import { HttpTestContext, TestContext } from 'testlib'

export interface AllProviders {
    customersService: CustomersClient
    storageFilesService: StorageFilesClient
    moviesService: MoviesClient
    theatersService: TheatersClient
    showtimeCreationService: ShowtimeCreationClient
    bookingService: BookingClient
    purchasesService: PurchaseRecordsClient
    recommendationService: RecommendationClient
    purchaseProcessService: PurchaseProcessClient
    ticketHoldingService: TicketHoldingClient
    ticketsService: TicketsClient
    paymentsService: PaymentsClient
    watchRecordsService: WatchRecordsClient
    showtimesService: ShowtimesClient
}

export const getAllProviders = async (
    gatewayContext: HttpTestContext,
    appsContext: TestContext,
    coresContext: TestContext,
    infrasContext: TestContext
) => {
    const { module: gatewayModule } = gatewayContext
    const customersService = gatewayModule.get(CustomersClient)
    const storageFilesService = gatewayModule.get(StorageFilesClient)
    const moviesService = gatewayModule.get(MoviesClient)
    const theatersService = gatewayModule.get(TheatersClient)
    const showtimeCreationService = gatewayModule.get(ShowtimeCreationClient)
    const bookingService = gatewayModule.get(BookingClient)
    const purchasesService = gatewayModule.get(PurchaseRecordsClient)
    const recommendationService = gatewayModule.get(RecommendationClient)
    const purchaseProcessService = gatewayModule.get(PurchaseProcessClient)

    const { module: appsModule } = appsContext
    const ticketHoldingService = appsModule.get(TicketHoldingClient)
    const ticketsService = appsModule.get(TicketsClient)
    const showtimesService = appsModule.get(ShowtimesClient)
    const watchRecordsService = appsModule.get(WatchRecordsClient)
    const paymentsService = appsModule.get(PaymentsClient)

    const { module: coresModule } = coresContext

    const { module: _infrasModule } = infrasContext

    return {
        customersService,
        storageFilesService,
        moviesService,
        theatersService,
        showtimeCreationService,
        bookingService,
        purchasesService,
        recommendationService,
        purchaseProcessService,
        ticketHoldingService,
        ticketsService,
        paymentsService,
        watchRecordsService,
        showtimesService
    }
}
