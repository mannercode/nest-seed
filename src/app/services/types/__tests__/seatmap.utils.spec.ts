import { Seatmap } from '..'

describe('Seatmap utilities', () => {
    it('getSeatCount and getAllSeats', async () => {
        const seatmap = { blocks: [{ name: 'A', rows: [{ name: '1', seats: 'OOOOXXOOOO' }] }] }
        const seatCount = Seatmap.getSeatCount(seatmap)
        const seats = Seatmap.getAllSeats(seatmap).map((seat) => seat)
        expect(seats).toHaveLength(seatCount)
    })
})
