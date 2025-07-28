import { Abstract } from '@nestjs/common'
import { Type } from '@nestjs/common/interfaces'
import { UnknownElementException } from '@nestjs/core/errors/exceptions'
import { TestingModule } from '@nestjs/testing'
import {
    BookingClient,
    PurchaseProcessClient,
    RecommendationClient,
    ShowtimeCreationClient
} from 'apps/applications'
import {
    CustomersClient,
    MoviesClient,
    PurchasesClient,
    ShowtimesClient,
    TheatersClient,
    TicketHoldingClient,
    TicketsClient,
    WatchRecordsClient
} from 'apps/cores'
import { PaymentsClient, StorageFilesClient } from 'apps/infrastructures'
import { HttpTestContext, TestContext } from 'testlib'

type InjectionToken<T> = Type<T> | Abstract<T> | string | symbol

export interface AllProviders {
    getProvider: <T = unknown>(token: InjectionToken<T>) => T
    customersService: CustomersClient
    storageFilesService: StorageFilesClient
    moviesService: MoviesClient
    theatersService: TheatersClient
    showtimeCreationService: ShowtimeCreationClient
    bookingService: BookingClient
    purchasesService: PurchasesClient
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
    const { module: appsModule } = appsContext
    const { module: coresModule } = coresContext
    const { module: infrasModule } = infrasContext

    const getProvider = <T = unknown>(token: InjectionToken<T>): T => {
        const pools: TestingModule[] = [appsModule, coresModule, infrasModule, gatewayModule]

        for (const ref of pools) {
            try {
                return ref.get<T>(token)
            } catch (err) {
                if (!(err instanceof UnknownElementException)) throw err
            }
        }

        const tokenToString = (token: InjectionToken<T>): string => {
            if (typeof token === 'string') return token
            if (typeof token === 'symbol') return token.description ?? token.toString()
            if (typeof token === 'function') return token.name
            return '[unknown-token]'
        }

        throw new Error(
            `Nest could not find ${tokenToString(token)} element (this provider does not exist in the current context)`
        )
    }

    const customersService = gatewayModule.get(CustomersClient)
    const storageFilesService = gatewayModule.get(StorageFilesClient)
    const moviesService = gatewayModule.get(MoviesClient)
    const theatersService = gatewayModule.get(TheatersClient)
    const showtimeCreationService = gatewayModule.get(ShowtimeCreationClient)
    const bookingService = gatewayModule.get(BookingClient)
    const purchasesService = gatewayModule.get(PurchasesClient)
    const recommendationService = gatewayModule.get(RecommendationClient)
    const purchaseProcessService = gatewayModule.get(PurchaseProcessClient)

    const ticketHoldingService = appsModule.get(TicketHoldingClient)
    const ticketsService = appsModule.get(TicketsClient)
    const showtimesService = appsModule.get(ShowtimesClient)
    const watchRecordsService = appsModule.get(WatchRecordsClient)

    const paymentsService = coresModule.get(PaymentsClient)

    return {
        getProvider,
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
