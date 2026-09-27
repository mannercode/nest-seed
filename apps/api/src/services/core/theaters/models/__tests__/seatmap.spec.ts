import { Seatmap } from '../index.js'

describe('Seatmap', () => {
    describe('getSeatCount', () => {
        describe('한 행에 활성 좌석 8개와 비활성 좌석 2개가 있으면', () => {
            let seatmap: Parameters<typeof Seatmap.getSeatCount>[0]
            beforeEach(() => {
                seatmap = { blocks: [{ name: 'A', rows: [{ name: '1', layout: 'OOOOXXOOOO' }] }] }
            })
            it('좌석 수를 계산하면 8을 반환한다', () => {
                const count = Seatmap.getSeatCount(seatmap)

                expect(count).toEqual(8)
            })
        })

        describe('여러 블록과 행에 활성 좌석 9개가 있으면', () => {
            let seatmap: Parameters<typeof Seatmap.getSeatCount>[0]
            beforeEach(() => {
                seatmap = {
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
                }
            })
            it('좌석 수를 계산하면 9를 반환한다', () => {
                const count = Seatmap.getSeatCount(seatmap)

                expect(count).toEqual(9)
            })
        })

        describe('블록이 비어 있으면', () => {
            let seatmap: Parameters<typeof Seatmap.getSeatCount>[0]
            beforeEach(() => {
                seatmap = { blocks: [] }
            })
            it('좌석 수를 계산하면 0을 반환한다', () => {
                const count = Seatmap.getSeatCount(seatmap)

                expect(count).toEqual(0)
            })
        })

        describe('모든 좌석이 비활성이면', () => {
            let seatmap: Parameters<typeof Seatmap.getSeatCount>[0]
            beforeEach(() => {
                seatmap = { blocks: [{ name: 'A', rows: [{ name: '1', layout: 'XXXX' }] }] }
            })
            it('좌석 수를 계산하면 0을 반환한다', () => {
                const count = Seatmap.getSeatCount(seatmap)

                expect(count).toEqual(0)
            })
        })
    })

    describe('getAllSeats', () => {
        describe('활성 좌석과 비활성 좌석이 섞여 있으면', () => {
            let seatmap: Parameters<typeof Seatmap.getAllSeats>[0]
            beforeEach(() => {
                seatmap = { blocks: [{ name: 'A', rows: [{ name: '1', layout: 'OXOO' }] }] }
            })
            it('좌석을 조회하면 활성 좌석의 좌표만 반환한다', () => {
                const seats = Seatmap.getAllSeats(seatmap)

                expect(seats).toEqual([
                    { block: 'A', row: '1', seatNumber: 1 },
                    { block: 'A', row: '1', seatNumber: 3 },
                    { block: 'A', row: '1', seatNumber: 4 }
                ])
            })
        })

        describe('여러 블록과 행에 활성 좌석이 있으면', () => {
            let seatmap: Parameters<typeof Seatmap.getAllSeats>[0]
            beforeEach(() => {
                seatmap = {
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
                }
            })
            it('좌석을 조회하면 모든 활성 좌석의 좌표를 반환한다', () => {
                const seats = Seatmap.getAllSeats(seatmap)

                expect(seats).toEqual([
                    { block: 'A', row: '1', seatNumber: 1 },
                    { block: 'A', row: '1', seatNumber: 2 },
                    { block: 'A', row: '2', seatNumber: 2 },
                    { block: 'B', row: '1', seatNumber: 1 }
                ])
            })
        })

        describe('블록이 비어 있으면', () => {
            let seatmap: Parameters<typeof Seatmap.getAllSeats>[0]
            beforeEach(() => {
                seatmap = { blocks: [] }
            })
            it('좌석을 조회하면 빈 배열을 반환한다', () => {
                const seats = Seatmap.getAllSeats(seatmap)

                expect(seats).toEqual([])
            })
        })
    })
})
