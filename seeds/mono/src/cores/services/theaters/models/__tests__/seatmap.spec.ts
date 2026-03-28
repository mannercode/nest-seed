import { Seatmap } from '..'

describe('Seatmap', () => {
    describe('getSeatCount', () => {
        // 좌석 배치가 제공될 때
        describe('when the seatmap is provided', () => {
            // 좌석 수를 반환한다
            it('returns the number of seats', () => {
                const count = Seatmap.getSeatCount({
                    blocks: [{ name: 'A', rows: [{ name: '1', layout: 'OOOOXXOOOO' }] }]
                })

                expect(count).toEqual(8)
            })
        })

        // 다중 블록과 다중 행이 제공될 때
        describe('when multiple blocks and rows are provided', () => {
            // 전체 좌석 수를 반환한다
            it('returns the total seat count', () => {
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
        })

        // 빈 좌석 배치가 제공될 때
        describe('when the seatmap is empty', () => {
            // 0을 반환한다
            it('returns 0', () => {
                const count = Seatmap.getSeatCount({ blocks: [] })

                expect(count).toEqual(0)
            })
        })

        // 모든 좌석이 비활성일 때
        describe('when all seats are disabled', () => {
            // 0을 반환한다
            it('returns 0', () => {
                const count = Seatmap.getSeatCount({
                    blocks: [{ name: 'A', rows: [{ name: '1', layout: 'XXXX' }] }]
                })

                expect(count).toEqual(0)
            })
        })
    })

    describe('getAllSeats', () => {
        // 좌석 배치가 제공될 때
        describe('when the seatmap is provided', () => {
            // 모든 좌석을 반환한다
            it('returns all seats', () => {
                const seats = Seatmap.getAllSeats({
                    blocks: [{ name: 'A', rows: [{ name: '1', layout: 'OXOO' }] }]
                })

                expect(seats).toEqual([
                    { block: 'A', row: '1', seatNumber: 1 },
                    { block: 'A', row: '1', seatNumber: 3 },
                    { block: 'A', row: '1', seatNumber: 4 }
                ])
            })
        })

        // 다중 블록과 다중 행이 제공될 때
        describe('when multiple blocks and rows are provided', () => {
            // 모든 블록과 행의 좌석을 반환한다
            it('returns seats from all blocks and rows', () => {
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
        })

        // 빈 좌석 배치가 제공될 때
        describe('when the seatmap is empty', () => {
            // 빈 배열을 반환한다
            it('returns an empty array', () => {
                const seats = Seatmap.getAllSeats({ blocks: [] })

                expect(seats).toEqual([])
            })
        })
    })
})
