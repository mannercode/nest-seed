import type { ShowtimeDto, TicketSalesForShowtimeDto } from 'core'
import { generateShowtimesForBooking } from '../booking.utils'

describe('generateShowtimesForBooking', () => {
    const showtime: ShowtimeDto = {
        endTime: new Date('2099-01-01T12:00'),
        id: 'sh1',
        movieId: 'mv1',
        startTime: new Date('2099-01-01T10:00'),
        theaterId: 'th1'
    }

    // showtime 의 ticket sales 정보가 누락되었을 때
    describe('when ticket sales for a showtime are missing', () => {
        // 명시적 에러를 던진다
        it('throws explicitly', () => {
            expect(() => generateShowtimesForBooking([showtime], [])).toThrow(/sh1/)
        })
    })

    // ticket sales 정보가 모든 showtime 에 대해 제공되었을 때
    describe('when ticket sales are provided for all showtimes', () => {
        // ticketSales 가 매핑된 showtime 들을 반환한다
        it('returns showtimes with mapped ticketSales', () => {
            const sales: TicketSalesForShowtimeDto = {
                available: 5,
                showtimeId: 'sh1',
                sold: 3,
                total: 8
            }

            const result = generateShowtimesForBooking([showtime], [sales])
            expect(result).toEqual([
                expect.objectContaining({
                    id: 'sh1',
                    ticketSales: { available: 5, sold: 3, total: 8 }
                })
            ])
        })
    })
})
