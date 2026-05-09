import { Seatmap } from '..'

describe('Seatmap', () => {
    describe('getSeatCount', () => {
        it('한 행의 활성 좌석 수를 반환한다', () => {
            const count = Seatmap.getSeatCount({
                blocks: [{ name: 'A', rows: [{ name: '1', layout: 'OOOOXXOOOO' }] }]
            })

            expect(count).toEqual(8)
        })

        it('여러 블록과 여러 행의 좌석 수를 합산한다', () => {
            const count = Seatmap.getSeatCount({
                blocks: [
                    {
                        name: 'A',
                        rows: [
                            { name: '1', layout: 'OOOO' },
                            { name: '2', layout: 'XXOO' }
                        ]
                    },
                    { name: 'B', rows: [{ name: '1', layout: 'OOO' }] }
                ]
            })

            expect(count).toEqual(9)
        })

        it('블록이 비어 있으면 0을 반환한다', () => {
            const count = Seatmap.getSeatCount({ blocks: [] })

            expect(count).toEqual(0)
        })

        it('모든 좌석이 비활성이면 0을 반환한다', () => {
            const count = Seatmap.getSeatCount({
                blocks: [{ name: 'A', rows: [{ name: '1', layout: 'XXXX' }] }]
            })

            expect(count).toEqual(0)
        })
    })

    describe('getAllSeats', () => {
        it('활성 좌석의 좌표 목록을 반환한다', () => {
            const seats = Seatmap.getAllSeats({
                blocks: [{ name: 'A', rows: [{ name: '1', layout: 'OXOO' }] }]
            })

            expect(seats).toEqual([
                { block: 'A', row: '1', seatNumber: 1 },
                { block: 'A', row: '1', seatNumber: 3 },
                { block: 'A', row: '1', seatNumber: 4 }
            ])
        })

        it('여러 블록과 여러 행의 좌석을 모두 반환한다', () => {
            const seats = Seatmap.getAllSeats({
                blocks: [
                    {
                        name: 'A',
                        rows: [
                            { name: '1', layout: 'OO' },
                            { name: '2', layout: 'XO' }
                        ]
                    },
                    { name: 'B', rows: [{ name: '1', layout: 'O' }] }
                ]
            })

            expect(seats).toEqual([
                { block: 'A', row: '1', seatNumber: 1 },
                { block: 'A', row: '1', seatNumber: 2 },
                { block: 'A', row: '2', seatNumber: 2 },
                { block: 'B', row: '1', seatNumber: 1 }
            ])
        })

        it('블록이 비어 있으면 빈 배열을 반환한다', () => {
            const seats = Seatmap.getAllSeats({ blocks: [] })

            expect(seats).toEqual([])
        })
    })
})
