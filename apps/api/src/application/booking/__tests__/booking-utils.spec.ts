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

    it('showtime의 ticketSales 정보가 누락되면 예외를 던진다', () => {
        expect(() => generateShowtimesForBooking([showtime], [])).toThrow(/sh1/)
    })

    it('모든 showtime에 ticketSales가 있으면 매핑된 결과를 반환한다', () => {
        const sales: TicketSalesForShowtimeDto = {
            available: 5,
            showtimeId: 'sh1',
            sold: 3,
            total: 8
        }

        const result = generateShowtimesForBooking([showtime], [sales])
        expect(result).toEqual([
            expect.objectContaining({ id: 'sh1', ticketSales: { available: 5, sold: 3, total: 8 } })
        ])
    })
})
