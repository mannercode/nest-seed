import { createMessagePatternMap } from '../utils'

describe('createMessagePatternMap', () => {
    describe('when mapping two levels', () => {
        it('returns a dot-delimited path', () => {
            const Messages = createMessagePatternMap({ Movies: { searchPage: null, create: null } })

            expect(Messages.Movies.searchPage).toEqual('Movies.searchPage')
        })
    })

    describe('when mapping three levels', () => {
        it('returns a dot-delimited path', () => {
            const Messages = createMessagePatternMap({ Apps: { Tickets: { findTickets: null } } })

            expect(Messages.Apps.Tickets.findTickets).toEqual('Apps.Tickets.findTickets')
        })
    })

    describe('when a prefix is provided', () => {
        it('returns a prefixed path', () => {
            const Messages = createMessagePatternMap(
                { Movies: { searchPage: null, create: null } },
                'Prefix'
            )

            expect(Messages.Movies.searchPage).toEqual('Prefix.Movies.searchPage')
        })
    })
})
