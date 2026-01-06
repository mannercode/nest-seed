import { Seatmap } from '..'

describe('Seatmap', () => {
    describe('getSeatCount', () => {
        // 좌석 배치가 제공될 때
        describe('when the seatmap is provided', () => {
            // 좌석 수를 반환한다
            it('returns the number of seats', async () => {
                const count = Seatmap.getSeatCount({
                    blocks: [{ name: 'A', rows: [{ name: '1', seats: 'OOOOXXOOOO' }] }]
                })

                expect(count).toEqual(8)
            })
        })
    })
})
