import {
    CustomerDto,
    MovieDto,
    PurchaseItemType,
    Seatmap,
    ShowtimeDto,
    TheaterDto,
    TicketDto
} from 'apps/cores'
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
    createTickets
} from '../common.fixture'

const createShowtime = async (fix: Fixture, startTime: Date) => {
    const { createDto } = buildCreateShowtimeDto({
        movieId: fix.movie.id,
        theaterId: fix.theater.id,
        startTime,
        endTime: DateUtil.addMinutes(startTime, 1)
    })

    const showtimes = await createShowtimes(fix, [createDto])
    return showtimes[0]
}

const createAllTickets = async (fix: Fixture, showtime: ShowtimeDto) => {
    const createTicketDtos = Seatmap.getAllSeats(fix.theater.seatmap).map((seat) => {
        const { createDto } = buildCreateTicketDto({
            movieId: showtime.movieId,
            theaterId: showtime.theaterId,
            showtimeId: showtime.id,
            seat
        })
        return createDto
    })

    const tickets = await createTickets(fix, createTicketDtos)
    return tickets
}

const holdTickets = async (fix: Fixture, showtimeId: string, tickets: TicketDto[]) => {
    await fix.ticketHoldingService.holdTickets({
        customerId: fix.customer.id,
        showtimeId,
        ticketIds: pickIds(tickets)
    })
}

export const setupPurchaseData = async (
    fix: Fixture,
    opts?: { holdCount?: number; minutesFromNow?: number }
) => {
    const {
        holdCount: itemCount = Rules.Ticket.maxTicketsPerPurchase,
        minutesFromNow = Rules.Ticket.purchaseDeadlineInMinutes + 1
    } = opts || {}

    const showtime = await createShowtime(fix, DateUtil.addMinutes(new Date(), minutesFromNow))

    const tickets = await createAllTickets(fix, showtime)

    const heldTickets = tickets.slice(0, itemCount)
    const availableTickets = tickets.slice(itemCount)

    await holdTickets(fix, showtime.id, heldTickets)

    const purchaseItems = heldTickets.map((ticket) => ({
        type: PurchaseItemType.Ticket,
        ticketId: ticket.id
    }))

    return { showtime, purchaseItems, availableTickets }
}

export interface Fixture extends CommonFixture {
    teardown: () => Promise<void>
    customer: CustomerDto
    movie: MovieDto
    theater: TheaterDto
}

export const createFixture = async () => {
    const commonFixture = await createCommonFixture()

    const customer = await createCustomer(commonFixture)
    const movie = await createMovie(commonFixture)
    const theater = await createTheater(commonFixture, {
        seatmap: { blocks: [{ name: 'A', rows: [{ name: '1', seats: 'OOOOOOOOOOOO' }] }] }
    })

    const teardown = async () => {
        await commonFixture?.close()
    }

    return { ...commonFixture, teardown, customer, movie, theater }
}
