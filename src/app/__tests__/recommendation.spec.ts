import { MovieDto } from 'services/movies'
import { ShowtimesService } from 'services/showtimes'
import { TheaterDto } from 'services/theaters'
import { HttpTestClient } from 'testlib'
import {
    closeFixture,
    createFixture,
    IsolatedFixture
} from './showtime-creation.fixture'

describe.skip('Recommendation Module', () => {
    let isolated: IsolatedFixture
    let client: HttpTestClient
    let showtimesService: ShowtimesService
    let movie: MovieDto
    let theater: TheaterDto

    beforeEach(async () => {
        isolated = await createFixture()
        client = isolated.testContext.client
        showtimesService = isolated.showtimesService
        movie = isolated.movie
        theater = isolated.theater
    })

    afterEach(async () => {
        await closeFixture(isolated)
    })

    describe('추천 영화 목록 요청', () => {
        it('추천 영화 목록을 반환해야 한다', async () => {
            const { body } = await client.get('/movies/recommended').ok()
            const { items, ...paginated } = body

            expect(paginated).toEqual({ skip: 0, take: expect.any(Number), total: 1 })
            expect(items).toEqual([movie])
        })
    })
})

// generateMovieRecommendations(movies, watchedMovies){
//     아래 순서로 간단하게 구현한다.
//     1. genre 일치
//     2. 최신 개봉일

//     showingMovies는 ShowingService에서 관리한다.
//     ShowingMovie{
//     ...
//     theaterIds:[]
//     }
// }
