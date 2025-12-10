import { RecommendationClient } from 'apps/applications'
import { MovieDto, MoviesClient, MoviesModule } from 'apps/cores'
import { MoviesController } from 'apps/gateway'
import { AssetsClient, AssetsModule } from 'apps/infrastructures'
import {
    createMovie,
    createTestFixture,
    FixtureFile,
    fixtureFiles,
    TestFixture
} from '../__helpers__'

export type MoviesFixture = TestFixture & {
    createdMovie: MovieDto
    assetsClient: AssetsClient
    image: FixtureFile
}

export async function createMoviesFixture() {
    const fix = await createTestFixture({
        imports: [MoviesModule, AssetsModule],
        providers: [MoviesClient, RecommendationClient, AssetsClient],
        controllers: [MoviesController]
    })

    const assetsClient = fix.module.get(AssetsClient)
    const createdMovie = await createMovie(fix)

    return { ...fix, image: fixtureFiles.image, createdMovie, assetsClient }
}
