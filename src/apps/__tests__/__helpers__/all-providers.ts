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
    customersClient: CustomersClient
    storageFilesClient: StorageFilesClient
    moviesClient: MoviesClient
    theatersClient: TheatersClient
    showtimeCreationClient: ShowtimeCreationClient
    bookingClient: BookingClient
    purchasesClient: PurchasesClient
    recommendationClient: RecommendationClient
    purchaseProcessClient: PurchaseProcessClient
    ticketHoldingClient: TicketHoldingClient
    ticketsClient: TicketsClient
    paymentsClient: PaymentsClient
    watchRecordsClient: WatchRecordsClient
    showtimesClient: ShowtimesClient
    getProvider: <T = unknown>(token: InjectionToken<T>) => T
}

export const getAllProviders = async (
    gatewayContext: HttpTestContext,
    appsContext: TestContext,
    coresContext: TestContext,
    infrasContext: TestContext
) => {
    const { module: gatewayModule } = gatewayContext
    const customersClient = gatewayModule.get(CustomersClient)
    const storageFilesClient = gatewayModule.get(StorageFilesClient)
    const moviesClient = gatewayModule.get(MoviesClient)
    const theatersClient = gatewayModule.get(TheatersClient)
    const showtimeCreationClient = gatewayModule.get(ShowtimeCreationClient)
    const bookingClient = gatewayModule.get(BookingClient)
    const purchasesClient = gatewayModule.get(PurchasesClient)
    const recommendationClient = gatewayModule.get(RecommendationClient)
    const purchaseProcessClient = gatewayModule.get(PurchaseProcessClient)

    const { module: appsModule } = appsContext
    const ticketHoldingClient = appsModule.get(TicketHoldingClient)
    const ticketsClient = appsModule.get(TicketsClient)
    const showtimesClient = appsModule.get(ShowtimesClient)
    const watchRecordsClient = appsModule.get(WatchRecordsClient)

    const { module: coresModule } = coresContext
    const paymentsClient = coresModule.get(PaymentsClient)

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

    return {
        customersClient,
        storageFilesClient,
        moviesClient,
        theatersClient,
        showtimeCreationClient,
        bookingClient,
        purchasesClient,
        recommendationClient,
        purchaseProcessClient,
        ticketHoldingClient,
        ticketsClient,
        paymentsClient,
        watchRecordsClient,
        showtimesClient,
        getProvider
    }
}
