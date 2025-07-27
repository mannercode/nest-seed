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
import { nullDate, nullObjectId, testObjectId } from 'testlib'
import { CommonFixture, TestFiles } from './__helpers__'

export const createCustomerAndLogin = async (fix: CommonFixture) => {
    const email = 'user@mail.com'
    const password = 'password'
    const customer = await createCustomer(fix, { email, password })

    const { accessToken } = await fix.customersClient.generateAuthTokens({
        customerId: customer.id,
        email
    })

    return { customer, accessToken }
}

export const buildCreateCustomerDto = (overrides = {}) => {
    const createDto = {
        name: 'name',
        email: 'name@mail.com',
        birthDate: new Date('2020-12-12'),
        password: 'password',
        ...overrides
    }

    return createDto
}

export const createCustomer = async (fix: CommonFixture, override = {}) => {
    const createDto = buildCreateCustomerDto(override)

    const customer = await fix.customersClient.createCustomer(createDto)
    return customer
}

export const buildCreateMovieDto = (overrides = {}) => {
    const createDto = {
        title: `MovieTitle`,
        genres: [MovieGenre.Action],
        releaseDate: new Date('1900-01-01'),
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

    const movie = await fix.moviesClient.createMovie(createDto, [TestFiles.image])
    return movie
}

export const buildCreateTheaterDto = (overrides = {}) => {
    const createDto = {
        name: `theater name`,
        location: { latitude: 38.123, longitude: 138.678 },
        seatmap: { blocks: [{ name: 'A', rows: [{ name: '1', seats: 'OOOOXXOOOO' }] }] },
        ...overrides
    }

    return createDto
}

export const createTheater = async (fix: CommonFixture, override = {}) => {
    const createDto = buildCreateTheaterDto(override)

    const theater = await fix.theatersClient.createTheater(createDto)
    return theater
}

export const buildCreateShowtimeDto = (overrides: Partial<CreateShowtimeDto> = {}) => {
    const createDto = {
        transactionId: nullObjectId,
        movieId: nullObjectId,
        theaterId: nullObjectId,
        startTime: new Date('2000-01-01T12:00'),
        endTime: new Date('2000-01-01T12:01'),
        ...overrides
    }

    createDto.endTime = DateUtil.addMinutes(createDto.startTime, 1)
    return createDto
}

export const createShowtimes = async (fix: CommonFixture, createDtos: CreateShowtimeDto[]) => {
    const { success } = await fix.showtimesClient.createShowtimes(createDtos)
    expect(success).toBeTruthy()

    const transactionIds = uniq(createDtos.map((dto) => dto.transactionId))

    const showtimes = await fix.showtimesClient.searchShowtimes({ transactionIds })
    return showtimes
}

export const buildCreateTicketDto = (overrides = {}) => {
    const createDto = {
        transactionId: newObjectId(),
        movieId: nullObjectId,
        theaterId: nullObjectId,
        showtimeId: nullObjectId,
        status: TicketStatus.Available,
        seat: { block: '1b', row: '1r', seatNumber: 1 },
        ...overrides
    }
    return createDto
}

export const createTickets = async (fix: CommonFixture, createDtos: CreateTicketDto[]) => {
    const { success } = await fix.ticketsClient.createTickets(createDtos)
    expect(success).toBeTruthy()

    const transactionIds = uniq(createDtos.map((dto) => dto.transactionId))

    const tickets = await fix.ticketsClient.searchTickets({ transactionIds })
    return tickets
}

export const buildCreateWatchRecordDto = (overrides = {}) => {
    const createDto = {
        customerId: nullObjectId,
        movieId: nullObjectId,
        purchaseId: nullObjectId,
        watchDate: nullDate,
        ...overrides
    }

    return createDto
}

export const createWatchRecord = async (fix: CommonFixture, override = {}) => {
    const createDto = buildCreateWatchRecordDto(override)

    const watchRecord = await fix.watchRecordsClient.createWatchRecord(createDto)
    return watchRecord
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

export const holdTickets = async (fix: CommonFixture, holdDto?: Partial<HoldTicketsDto>) => {
    return fix.ticketHoldingClient.holdTickets({
        customerId: nullObjectId,
        showtimeId: nullObjectId,
        ticketIds: [testObjectId(0x30), testObjectId(0x31)],
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
