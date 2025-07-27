import {
    CustomerDto,
    MovieDto,
    PurchaseDto,
    PurchaseItemDto,
    PurchaseItemType,
    Seatmap,
    TheaterDto,
    TicketDto
} from 'apps/cores'
import { DateUtil, pickIds } from 'common'
import { Rules } from 'shared'
import { nullObjectId } from 'testlib'
import { CommonFixture, createCommonFixture } from '../__helpers__'
import {
    buildCreateShowtimeDto,
    buildCreateTicketDto,
    createCustomer,
    createMovie,
    createShowtimes,
    createTheater,
    createTickets,
    holdTickets
} from '../common.fixture'

export interface Fixture extends CommonFixture {
    teardown: () => Promise<void>
    customer: CustomerDto
    heldTickets: TicketDto[]
    availableTickets: TicketDto[]
    saleClosedTickets: TicketDto[]
    purchase: PurchaseDto
    purchaseItems: PurchaseItemDto[]
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

    const saleClosedTickets = await createSaleClosedTickets(fix, movie, theater)

    const purchaseItems = heldTickets.map(({ id }) => ({
        type: PurchaseItemType.Ticket,
        ticketId: id
    }))

    const purchase = await createPurchase(fix)

    return {
        ...fix,
        teardown: () => fix.close(),
        customer,
        heldTickets,
        availableTickets,
        saleClosedTickets,
        purchase,
        purchaseItems
    }
}

export const buildCreatePurchaseDto = (overrides = {}) => {
    const createDto = {
        customerId: nullObjectId,
        totalPrice: 1,
        purchaseItems: [{ type: PurchaseItemType.Ticket, ticketId: nullObjectId }],
        ...overrides
    }
    return createDto
}

export const createPurchase = async (fix: CommonFixture, override = {}) => {
    const createDto = buildCreatePurchaseDto(override)

    const purchase = await fix.purchasesService.createPurchase(createDto)

    return purchase
}

const createAvailableAndHeldTickets = async (
    fix: CommonFixture,
    movie: MovieDto,
    theater: TheaterDto,
    customer: CustomerDto
) => {
    const saleWindowStart = DateUtil.addMinutes(
        new Date(),
        Rules.Ticket.purchaseDeadlineInMinutes + 1
    )
    const purchasableTickets = await createAllTickets(fix, movie, theater, saleWindowStart)

    const holdCount = 4
    Rules.Ticket.maxTicketsPerPurchase = holdCount

    const heldTickets = purchasableTickets.slice(0, holdCount)
    const availableTickets = purchasableTickets.slice(holdCount)

    await holdTickets(fix, {
        customerId: customer.id,
        showtimeId: heldTickets[0].showtimeId,
        ticketIds: pickIds(heldTickets)
    })

    return { availableTickets, heldTickets }
}

const createSaleClosedTickets = async (
    fix: CommonFixture,
    movie: MovieDto,
    theater: TheaterDto
) => {
    const saleClosedAt = DateUtil.addMinutes(new Date(), Rules.Ticket.purchaseDeadlineInMinutes - 1)
    const saleClosedTickets = await createAllTickets(fix, movie, theater, saleClosedAt)
    return saleClosedTickets
}

const createAllTickets = async (
    fix: CommonFixture,
    movie: MovieDto,
    theater: TheaterDto,
    startTime: Date
) => {
    const createDto = buildCreateShowtimeDto({
        movieId: movie.id,
        theaterId: theater.id,
        startTime,
        endTime: DateUtil.addMinutes(startTime, 1)
    })

    const showtime = (await createShowtimes(fix, [createDto]))[0]

    const createDtos = Seatmap.getAllSeats(theater.seatmap).map((seat) =>
        buildCreateTicketDto({
            movieId: showtime.movieId,
            theaterId: showtime.theaterId,
            showtimeId: showtime.id,
            seat
        })
    )

    return createTickets(fix, createDtos)
}
