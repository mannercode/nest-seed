import { Seatmap } from '..'

it('returns the number of seats in the seatmap', async () => {
    const count = Seatmap.getSeatCount({
        blocks: [{ name: 'A', rows: [{ name: '1', seats: 'OOOOXXOOOO' }] }]
    })

    expect(count).toEqual(8)
})
