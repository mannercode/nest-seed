import { BookingClient, BookingModule, PurchaseModule } from 'apps/applications'
import {
    CustomersClient,
    CustomersModule,
    MoviesClient,
    MoviesModule,
    PurchaseRecordsModule,
    Seatmap,
    ShowtimesClient,
    ShowtimesModule,
    TheaterLocation,
    TheatersClient,
    TheatersModule,
    TicketHoldingModule,
    TicketsClient,
    TicketsModule
} from 'apps/cores'
import { BookingController, CustomerJwtStrategy } from 'apps/gateway'
import { PaymentsModule, StorageFilesModule } from 'apps/infrastructures'
import { TestContext } from 'testlib'
import {
    createCustomerAndLogin2,
    createMovie2,
    createShowtimes2,
    createTestFixture,
    createTheater2,
    createTickets2,
    TestFixture
} from '../__helpers__'

export const createAllResources = async (
    ctx: TestContext,
    locations: TheaterLocation[],
    startTimes: Date[]
) => {
    const { customer, accessToken, refreshToken } = await createCustomerAndLogin2(ctx)

    const movie = await createMovie2(ctx)

    const seatmap = { blocks: [{ name: 'A', rows: [{ name: '1', seats: 'OOOOOOOO' }] }] }

    const theaters = await Promise.all(
        locations.map((location) => createTheater2(ctx, { seatmap, location }))
    )

    const createShowtimeDtos = startTimes.flatMap((startTime) =>
        theaters.map((theater) => ({ movieId: movie.id, theaterId: theater.id, startTime }))
    )

    const showtimes = await createShowtimes2(ctx, createShowtimeDtos)

    const createTicketDtos = showtimes.flatMap(({ movieId, theaterId, id: showtimeId }) =>
        Seatmap.getAllSeats(seatmap).map((seat) => ({ movieId, theaterId, showtimeId, seat }))
    )

    const tickets = await createTickets2(ctx, createTicketDtos)

    return { customer, accessToken, refreshToken, movie, theaters, showtimes, tickets }
}

export type Fixture = TestFixture

export const createFixture = async (): Promise<Fixture> => {
    const fix = await createTestFixture({
        imports: [
            MoviesModule,
            StorageFilesModule,
            TheatersModule,
            TicketsModule,
            PurchaseRecordsModule,
            CustomersModule,
            ShowtimesModule,
            TicketHoldingModule,
            PaymentsModule,
            PurchaseModule,
            BookingModule
        ],
        providers: [
            CustomerJwtStrategy,
            CustomersClient,
            MoviesClient,
            ShowtimesClient,
            TheatersClient,
            TicketsClient,
            BookingClient
        ],
        controllers: [BookingController]
    })

    return { ...fix }
}
