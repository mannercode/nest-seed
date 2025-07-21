import { CustomerDto, MovieDto, Seatmap, TheaterDto, TicketDto } from 'apps/cores'
import { DateUtil, pickIds } from 'common'
import { Rules } from 'shared'
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
}

export const createFixture = async (): Promise<Fixture> => {
    const commonFixture = await createCommonFixture()

    const [customer, movie, theater] = await Promise.all([
        createCustomer(commonFixture),
        createMovie(commonFixture),
        createTheater(commonFixture)
    ])

    const { availableTickets, heldTickets } = await createAvailableAndHeldTickets(
        commonFixture,
        movie,
        theater,
        customer
    )

    const saleClosedTickets = await createSaleClosedTickets(commonFixture, movie, theater)

    return {
        ...commonFixture,
        teardown: () => commonFixture.close(),
        customer,
        heldTickets,
        availableTickets,
        saleClosedTickets
    }
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
    const { createDto } = buildCreateShowtimeDto({
        movieId: movie.id,
        theaterId: theater.id,
        startTime,
        endTime: DateUtil.addMinutes(startTime, 1)
    })

    const showtime = (await createShowtimes(fix, [createDto]))[0]

    const createDtos = Seatmap.getAllSeats(theater.seatmap).map((seat) => {
        const { createDto } = buildCreateTicketDto({
            movieId: showtime.movieId,
            theaterId: showtime.theaterId,
            showtimeId: showtime.id,
            seat
        })
        return createDto
    })

    return createTickets(fix, createDtos)
}
