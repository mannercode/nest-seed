import { createMessagePatternMap } from '../utils'

// TODO
describe('createRoutes', () => {
    // 2단계 경로를 생성해야 한다
    it('Should create a 2-level path', async () => {
        const Messages = createMessagePatternMap({
            Movies: { searchMoviesPage: null, createMovies: null }
        })

        expect(Messages.Movies.searchMoviesPage).toEqual('Movies.searchMoviesPage')
    })

    // 3단계 경로를 생성해야 한다
    it('Should create a 3-level path', async () => {
        const Messages = createMessagePatternMap({ Apps: { Tickets: { findTickets: null } } })

        expect(Messages.Apps.Tickets.findTickets).toEqual('Apps.Tickets.findTickets')
    })

    // prefix를 설정해야 한다
    it('Should set a prefix', async () => {
        const Messages = createMessagePatternMap(
            { Movies: { searchMoviesPage: null, createMovies: null } },
            'Prefix'
        )

        expect(Messages.Movies.searchMoviesPage).toEqual('Prefix.Movies.searchMoviesPage')
    })
})
