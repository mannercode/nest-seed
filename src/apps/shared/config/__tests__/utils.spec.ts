import { createMessagePatternMap } from '../utils'

describe('createMessagePatternMap', () => {
    // 2단계 점(.) 구분 경로를 반환한다
    it('returns a 2-level dot-delimited path', () => {
        const Messages = createMessagePatternMap({
            Movies: { searchPage: null, create: null }
        })

        expect(Messages.Movies.searchPage).toEqual('Movies.searchPage')
    })

    // 3단계 점(.) 구분 경로를 반환한다
    it('returns a 3-level dot-delimited path', () => {
        const Messages = createMessagePatternMap({ Apps: { Tickets: { findTickets: null } } })

        expect(Messages.Apps.Tickets.findTickets).toEqual('Apps.Tickets.findTickets')
    })

    // 지정된 prefix가 붙은 경로를 반환한다
    it('returns a path prefixed with the given prefix', () => {
        const Messages = createMessagePatternMap(
            { Movies: { searchPage: null, create: null } },
            'Prefix'
        )

        expect(Messages.Movies.searchPage).toEqual('Prefix.Movies.searchPage')
    })
})
