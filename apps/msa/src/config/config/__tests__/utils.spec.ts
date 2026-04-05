import { createMessagePatternMap } from '../utils'

describe('createMessagePatternMap', () => {
    // 두 단계로 매핑할 때
    describe('when mapping two levels', () => {
        // 점 구분 경로를 반환한다
        it('returns a dot-delimited path', () => {
            const Messages = createMessagePatternMap({ Movies: { create: null, searchPage: null } })

            expect(Messages.Movies.searchPage).toEqual('Movies.searchPage')
        })
    })

    // 세 단계로 매핑할 때
    describe('when mapping three levels', () => {
        // 점 구분 경로를 반환한다
        it('returns a dot-delimited path', () => {
            const Messages = createMessagePatternMap({ Apps: { Tickets: { findTickets: null } } })

            expect(Messages.Apps.Tickets.findTickets).toEqual('Apps.Tickets.findTickets')
        })
    })

    // prefix가 제공될 때
    describe('when a prefix is provided', () => {
        // prefix가 포함된 경로를 반환한다
        it('returns a prefixed path', () => {
            const Messages = createMessagePatternMap(
                { Movies: { create: null, searchPage: null } },
                'Prefix'
            )

            expect(Messages.Movies.searchPage).toEqual('Prefix.Movies.searchPage')
        })
    })
})
