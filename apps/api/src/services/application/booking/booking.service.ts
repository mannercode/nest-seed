import { DateUtil, pickIds } from '@mannercode/common'
import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException
} from '@nestjs/common'
import { AppConfigService } from '#config'
import {
    HoldTicketsDto,
    ShowtimesService,
    TheatersService,
    TicketHoldingService,
    TicketsService
} from '#core'
import { generateShowtimesForBooking, sortTheatersByDistance } from './booking.utils.js'
import {
    BookingSearchShowdatesDto,
    BookingSearchShowtimesDto,
    BookingSearchTheatersDto
} from './dtos/index.js'
import { BookingErrors } from './errors.js'

@Injectable()
export class BookingService {
    private readonly logger = new Logger(BookingService.name)

    constructor(
        private readonly config: AppConfigService,
        private readonly showtimesService: ShowtimesService,
        private readonly theatersService: TheatersService,
        private readonly ticketHoldingService: TicketHoldingService,
        private readonly ticketsService: TicketsService
    ) {}

    async getTickets(showtimeId: string) {
        const showtimeExists = await this.showtimesService.allExist([showtimeId])

        if (!showtimeExists) {
            throw new NotFoundException(BookingErrors.ShowtimeNotFound(showtimeId))
        }

        const tickets = await this.ticketsService.search({ showtimeIds: [showtimeId] })
        return tickets
    }

    async holdTickets(dto: HoldTicketsDto): Promise<void> {
        this.logger.log('holdTickets', { userId: dto.userId, ticketCount: dto.ticketIds.length })

        // 보유는 구매의 준비 단계이므로 구매 상한(maxPerPurchase)을 그대로 적용한다.
        const maxPerPurchase = this.config.ticket.maxPerPurchase
        if (maxPerPurchase < dto.ticketIds.length) {
            throw new BadRequestException(BookingErrors.HoldLimitExceeded(maxPerPurchase))
        }

        // 존재·상영 소속을 확인하지 않으면 임의 id로 다른 상영의 좌석까지 선점할 수 있다.
        // 존재하지 않는 티켓이 섞여 있으면 getMany가 404를 던진다.
        const tickets = await this.ticketsService.getMany(dto.ticketIds)
        const outOfShowtime = tickets.filter((ticket) => ticket.showtimeId !== dto.showtimeId)
        if (0 < outOfShowtime.length) {
            throw new BadRequestException(
                BookingErrors.TicketsNotInShowtime(pickIds(outOfShowtime), dto.showtimeId)
            )
        }

        const success = await this.ticketHoldingService.holdTickets(dto)

        if (!success) {
            throw new ConflictException(BookingErrors.TicketsAlreadyHeld())
        }
    }

    async searchShowdates({ movieId, theaterId }: BookingSearchShowdatesDto) {
        // 끝난 상영은 노출하지 않으려고 `endTime > now`로 거른다.
        // 추천과 상영 생성 화면도 같은 방식으로 미래 상영만 조회한다.
        // 결제 마감 시간은 결제 시점에서 따로 확인한다.
        return this.showtimesService.searchShowdates({
            endTimeRange: { start: DateUtil.now() },
            movieIds: [movieId],
            theaterIds: [theaterId]
        })
    }

    async searchShowtimes({ movieId, showdate, theaterId }: BookingSearchShowtimesDto) {
        const startOfDay = DateUtil.startOfUtcDay(showdate)
        const endOfDay = DateUtil.endOfUtcDay(showdate)

        const showtimes = await this.showtimesService.search({
            endTimeRange: { start: DateUtil.now() },
            movieIds: [movieId],
            startTimeRange: { end: endOfDay, start: startOfDay },
            theaterIds: [theaterId]
        })

        const showtimeIds = pickIds(showtimes)
        const ticketSalesForShowtimes = await this.ticketsService.aggregateSales({ showtimeIds })

        const showtimesForBooking = generateShowtimesForBooking(showtimes, ticketSalesForShowtimes)

        return showtimesForBooking
    }

    async searchTheaters({ latLong, movieId }: BookingSearchTheatersDto) {
        const theaterIds = await this.showtimesService.searchTheaterIds({
            endTimeRange: { start: DateUtil.now() },
            movieIds: [movieId]
        })
        const theaters = await this.theatersService.getMany(theaterIds)
        const showingTheaters = sortTheatersByDistance(theaters, latLong)

        this.logger.log('searchTheaters', { movieId, theaterCount: showingTheaters.length })

        return showingTheaters
    }
}
