import {
    CreateShowtimeDto,
    CreateTicketDto,
    HoldTicketsDto,
    MovieGenre,
    MovieRating,
    PurchaseItemType,
    TicketStatus
} from 'apps/cores'
import { DateUtil, newObjectId } from 'common'
import { uniq } from 'lodash'
import { nullDate, testObjectId } from 'testlib'
import { CommonFixture } from './create-common-fixture'
import { TestFiles } from './files'

export const createCustomerAndLogin = async (fix: CommonFixture) => {
    const email = 'user@mail.com'
    const password = 'password'
    const customer = await createCustomer(fix, { email, password })

    const { accessToken } = await fix.customersService.generateAuthTokens({
        customerId: customer.id,
        email
    })

    return { customer, accessToken }
}

export const buildCreateCustomerDto = (overrides = {}) => {
    const createDto = {
        name: 'name',
        email: 'name@mail.com',
        birthDate: new Date(0),
        password: 'password',
        ...overrides
    }

    return createDto
}

export const createCustomer = async (fix: CommonFixture, override = {}) => {
    const createDto = buildCreateCustomerDto(override)

    const customer = await fix.customersService.createCustomer(createDto)
    return customer
}

export const buildCreateMovieDto = (overrides = {}) => {
    const createDto = {
        title: `MovieTitle`,
        genres: [MovieGenre.Action],
        releaseDate: new Date(0),
        plot: `MoviePlot`,
        durationInSeconds: 90 * 60,
        director: 'Quentin Tarantino',
        rating: MovieRating.PG,
        ...overrides
    }

    return createDto
}

export const createMovie = async (fix: CommonFixture, override = {}) => {
    const createDto = buildCreateMovieDto(override)

    const movie = await fix.moviesService.createMovie(createDto, [TestFiles.image])
    return movie
}

export const buildCreateTheaterDto = (overrides = {}) => {
    const createDto = {
        name: `theater name`,
        location: { latitude: 0, longitude: 0 },
        seatmap: { blocks: [{ name: 'A', rows: [{ name: '1', seats: 'OOOOXXOOOO' }] }] },
        ...overrides
    }

    return createDto
}

export const createTheater = async (fix: CommonFixture, override = {}) => {
    const createDto = buildCreateTheaterDto(override)

    const theater = await fix.theatersService.createTheater(createDto)
    return theater
}

export const buildCreateShowtimeDto = (overrides: Partial<CreateShowtimeDto> = {}) => {
    const createDto = {
        transactionId: newObjectId(),
        movieId: newObjectId(),
        theaterId: newObjectId(),
        startTime: new Date(0),
        endTime: new Date(0),
        ...overrides
    }

    if (overrides.endTime === undefined) {
        createDto.endTime = DateUtil.addMinutes(createDto.startTime, 1)
    }

    return createDto
}

export const createShowtimes = async (
    fix: CommonFixture,
    overrides: Partial<CreateShowtimeDto>[]
) => {
    const createDtos = overrides.map((override) => buildCreateShowtimeDto(override))

    const { success } = await fix.showtimesService.createShowtimes(createDtos)
    expect(success).toBeTruthy()

    const transactionIds = uniq(createDtos.map((dto) => dto.transactionId))

    const showtimes = await fix.showtimesService.searchShowtimes({ transactionIds })
    return showtimes
}

export const buildCreateTicketDto = (overrides = {}) => {
    const createDto = {
        transactionId: newObjectId(),
        movieId: newObjectId(),
        theaterId: newObjectId(),
        showtimeId: newObjectId(),
        status: TicketStatus.Available,
        seat: { block: '1b', row: '1r', seatNumber: 1 },
        ...overrides
    }
    return createDto
}

export const createTickets = async (fix: CommonFixture, createDtos: CreateTicketDto[]) => {
    const { success } = await fix.ticketsService.createTickets(createDtos)
    expect(success).toBeTruthy()

    const transactionIds = uniq(createDtos.map((dto) => dto.transactionId))

    const tickets = await fix.ticketsService.searchTickets({ transactionIds })
    return tickets
}

export const buildCreateWatchRecordDto = (overrides = {}) => {
    const createDto = {
        customerId: newObjectId(),
        movieId: newObjectId(),
        purchaseId: newObjectId(),
        watchDate: nullDate,
        ...overrides
    }

    return createDto
}

export const createWatchRecord = async (fix: CommonFixture, override = {}) => {
    const createDto = buildCreateWatchRecordDto(override)

    const watchRecord = await fix.watchRecordsService.createWatchRecord(createDto)
    return watchRecord
}

export const buildCreatePurchaseDto = (overrides = {}) => {
    const createDto = {
        customerId: newObjectId(),
        totalPrice: 1,
        purchaseItems: [{ type: PurchaseItemType.Ticket, ticketId: newObjectId() }],
        ...overrides
    }
    return createDto
}

export const createPurchase = async (fix: CommonFixture, override = {}) => {
    const createDto = buildCreatePurchaseDto(override)

    const purchase = await fix.purchasesService.createPurchase(createDto)

    return purchase
}

export const holdTickets = async (fix: CommonFixture, holdDto?: Partial<HoldTicketsDto>) => {
    return fix.ticketHoldingService.holdTickets({
        customerId: newObjectId(),
        showtimeId: newObjectId(),
        ticketIds: [testObjectId(0x1), testObjectId(0x2)],
        ...holdDto
    })
}

export const getPayments = async (fix: CommonFixture, paymentIds: string[]) => {
    return fix.paymentsService.getPayments(paymentIds)
}

export const getTickets = async (fix: CommonFixture, ticketIds: string[]) => {
    return fix.ticketsService.getTickets(ticketIds)
}

export const getStorageFiles = async (fix: CommonFixture, fileIds: string[]) => {
    return fix.storageFilesService.getFiles(fileIds)
}
