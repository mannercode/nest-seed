import { createMessagePatternMap } from '../utils'

describe('createMessagePatternMap', () => {
    it('returns a 2-level dot-delimited path', () => {
        const Messages = createMessagePatternMap({ Movies: { searchPage: null, create: null } })

        expect(Messages.Movies.searchPage).toEqual('Movies.searchPage')
    })

    it('returns a 3-level dot-delimited path', () => {
        const Messages = createMessagePatternMap({ Apps: { Tickets: { findTickets: null } } })

        expect(Messages.Apps.Tickets.findTickets).toEqual('Apps.Tickets.findTickets')
    })

    it('returns a path prefixed with the given prefix', () => {
        const Messages = createMessagePatternMap(
            { Movies: { searchPage: null, create: null } },
            'Prefix'
        )

        expect(Messages.Movies.searchPage).toEqual('Prefix.Movies.searchPage')
    })
})
