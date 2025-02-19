import { createRouteMap } from 'common'

describe('createRoutes', () => {
    it('2단계 경로를 정의해야 한다', async () => {
        const Messages = createRouteMap({
            Movies: {
                findMovies: null,
                createMovies: null
            }
        })

        expect(Messages.Movies.findMovies).toEqual('Movies.findMovies')
    })

    it('3단계 경로를 정의해야 한다', async () => {
        const Messages = createRouteMap({
            Apps: {
                Tickets: {
                    findTickets: null
                }
            }
        })

        expect(Messages.Apps.Tickets.findTickets).toEqual('Apps.Tickets.findTickets')
    })

    it('prefix를 설정해야 한다', async () => {
        const Messages = createRouteMap(
            {
                Movies: {
                    findMovies: null,
                    createMovies: null
                }
            },
            'Prefix'
        )

        expect(Messages.Movies.findMovies).toEqual('Prefix.Movies.findMovies')
    })
})
