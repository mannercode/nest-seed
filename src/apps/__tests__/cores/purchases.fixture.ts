import {
    CustomerDto,
    MovieDto,
    PurchaseDto,
    PurchaseItemType,
    Seatmap,
    TheaterDto,
    TicketDto
} from 'apps/cores'
import { DateUtil, pickIds } from 'common'
import { Rules } from 'shared'
import {
    buildCreatePurchaseDto,
    buildCreateTicketDto,
    CommonFixture,
    createCommonFixture,
    createCustomer,
    createMovie,
    createPurchase,
    createShowtimes,
    createTheater,
    createTickets,
    holdTickets
} from '../__helpers__'

export interface Fixture extends CommonFixture {
    teardown: () => Promise<void>
    customer: CustomerDto
    heldTickets: TicketDto[]
    availableTickets: TicketDto[]
    closedSaleTickets: TicketDto[]
    purchase: PurchaseDto
}

export const createFixture = async (): Promise<Fixture> => {
    const fix = await createCommonFixture()

    const [customer, movie, theater] = await Promise.all([
        createCustomer(fix),
        createMovie(fix),
        createTheater(fix)
    ])

    const { availableTickets, heldTickets } = await createAvailableAndHeldTickets(
        fix,
        movie,
        theater,
        customer
    )

    const closedSaleTickets = await createClosedSaleTickets(fix, movie, theater)

    const purchase = await createPurchase(fix)

    const teardown = async () => {
        await fix?.close()
    }

    return {
        ...fix,
        teardown,
        customer,
        heldTickets,
        availableTickets,
        closedSaleTickets,
        purchase
    }
}

export const buildCreateTicketPurchaseDto = (customer: CustomerDto, tickets: TicketDto[]) => {
    const purchaseItems = tickets.map(({ id }) => ({
        type: PurchaseItemType.Ticket,
        ticketId: id
    }))

    return buildCreatePurchaseDto({ customerId: customer.id, purchaseItems })
}

const createAvailableAndHeldTickets = async (
    fix: CommonFixture,
    movie: MovieDto,
    theater: TheaterDto,
    customer: CustomerDto
) => {
    const purchasableAt = DateUtil.addMinutes(
        new Date(),
        Rules.Ticket.purchaseDeadlineInMinutes + 1
    )
    const createdTickets = await createAllTickets({
        fix,
        movie,
        theater,
        startTime: purchasableAt
    })

    const holdCount = 4
    Rules.Ticket.maxTicketsPerPurchase = holdCount

    const heldTickets = createdTickets.slice(0, holdCount)
    const availableTickets = createdTickets.slice(holdCount)

    await holdTickets(fix, {
        customerId: customer.id,
        showtimeId: heldTickets[0].showtimeId,
        ticketIds: pickIds(heldTickets)
    })

    return { availableTickets, heldTickets }
}

const createClosedSaleTickets = async (
    fix: CommonFixture,
    movie: MovieDto,
    theater: TheaterDto
) => {
    const nonPurchasableAt = DateUtil.addMinutes(
        new Date(),
        Rules.Ticket.purchaseDeadlineInMinutes - 1
    )

    const closedSaleTickets = await createAllTickets({
        fix,
        movie,
        theater,
        startTime: nonPurchasableAt
    })

    return closedSaleTickets
}

const createAllTickets = async ({
    fix,
    movie,
    theater,
    startTime
}: {
    fix: CommonFixture
    movie: MovieDto
    theater: TheaterDto
    startTime: Date
}) => {
    const createShowtimeDto = { movieId: movie.id, theaterId: theater.id, startTime }
    const showtimes = await createShowtimes(fix, [createShowtimeDto])

    const showtime = showtimes[0]

    const createTicketDtos = Seatmap.getAllSeats(theater.seatmap).map((seat) =>
        buildCreateTicketDto({
            movieId: showtime.movieId,
            theaterId: showtime.theaterId,
            showtimeId: showtime.id,
            seat
        })
    )

    return createTickets(fix, createTicketDtos)
}
