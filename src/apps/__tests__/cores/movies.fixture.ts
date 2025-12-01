import { RecommendationClient } from 'apps/applications'
import { MovieDto, MoviesClient, MoviesModule } from 'apps/cores'
import { MoviesController } from 'apps/gateway'
import { AssetsClient, AssetsModule } from 'apps/infrastructures'
import { Path } from 'common'
import {
    createMovie,
    createTestFixture,
    FixtureFile,
    fixtureFiles,
    TestFixture
} from '../__helpers__'

export type MoviesFixture = TestFixture & {
    image: FixtureFile
    createdMovie: MovieDto
    tempDir: string
    assetsClient: AssetsClient
}

export async function createMoviesFixture() {
    const fix = await createTestFixture({
        imports: [MoviesModule, AssetsModule],
        providers: [MoviesClient, RecommendationClient, AssetsClient],
        controllers: [MoviesController]
    })

    const assetsClient = fix.module.get(AssetsClient)

    const tempDir = await Path.createTempDirectory()

    const createdMovie = await createMovie(fix)

    async function teardown() {
        await fix.teardown()
        await Path.delete(tempDir)
    }

    return { ...fix, teardown, image: fixtureFiles.image, createdMovie, tempDir, assetsClient }
}
