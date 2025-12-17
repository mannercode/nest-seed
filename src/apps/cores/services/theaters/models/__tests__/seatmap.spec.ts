import { Seatmap } from '..'

describe('Seatmap', () => {
    describe('getSeatCount', () => {
        describe('when the seatmap is provided', () => {
            it('returns the number of seats', async () => {
                const count = Seatmap.getSeatCount({
                    blocks: [{ name: 'A', rows: [{ name: '1', seats: 'OOOOXXOOOO' }] }]
                })

                expect(count).toEqual(8)
            })
        })
    })
})
