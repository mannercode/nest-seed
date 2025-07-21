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
    movie: MovieDto
    theater: TheaterDto
    heldTickets: TicketDto[]
    availableTickets: TicketDto[]
    saleClosedTickets: TicketDto[]
}

export const createFixture = async (): Promise<Fixture> => {
    const commonFixture = await createCommonFixture()

    const [customer, movie, theater] = await Promise.all([
        createCustomer(commonFixture),
        createMovie(commonFixture),
        createTheater(commonFixture, {
            seatmap: { blocks: [{ name: 'A', rows: [{ name: '1', seats: 'OOOOOOOOOOOO' }] }] }
        })
    ])

    const startTime = DateUtil.addMinutes(new Date(), Rules.Ticket.purchaseDeadlineInMinutes + 1)
    const tickets = await createAllTickets(commonFixture, movie, theater, startTime)

    Rules.Ticket.maxTicketsPerPurchase = 4
    const holdCount = Rules.Ticket.maxTicketsPerPurchase
    const [heldTickets, availableTickets] = [tickets.slice(0, holdCount), tickets.slice(holdCount)]
    await holdTickets(commonFixture, {
        customerId: customer.id,
        showtimeId: heldTickets[0].showtimeId,
        ticketIds: pickIds(heldTickets)
    })

    const deadlineOverTime = DateUtil.addMinutes(
        new Date(),
        Rules.Ticket.purchaseDeadlineInMinutes - 1
    )
    const saleClosedTickets = await createAllTickets(
        commonFixture,
        movie,
        theater,
        deadlineOverTime
    )

    return {
        ...commonFixture,
        teardown: () => commonFixture.close(),
        customer,
        movie,
        theater,
        heldTickets,
        availableTickets,
        saleClosedTickets
    }
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
