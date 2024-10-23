import { getAllSeats, getSeatCount } from '../models'

describe('Seatmap utilities', () => {
    it('getSeatCount and getAllSeats', async () => {
        const seatmap = { blocks: [{ name: 'A', rows: [{ name: '1', seats: 'OOOOXXOOOO' }] }] }
        const seatCount = getSeatCount(seatmap)
        const seats = getAllSeats(seatmap).map((seat) => seat)
        expect(seats).toHaveLength(seatCount)
    })
})
