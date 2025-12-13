import {
    MovieDraftsClient,
    MovieDraftsModule,
    MovieDraftsRepository,
    RecommendationClient
} from 'apps/applications'
import { MoviesClient, MoviesModule } from 'apps/cores'
import { MovieDraftsController, MoviesController } from 'apps/gateway'
import { AssetsClient, AssetsModule } from 'apps/infrastructures'
import { Path } from 'common'
import { createAppTestContext, FixtureFile, fixtureFiles, TestFixture } from '../__helpers__'

export type MovieDraftsFixture = TestFixture & {
    image: FixtureFile
    tempDir: string
    assetsClient: AssetsClient
    movieDraftsRepository: MovieDraftsRepository
}

export async function createMovieDraftsFixture() {
    const fix = await createAppTestContext({
        imports: [MoviesModule, AssetsModule, MovieDraftsModule],
        providers: [MoviesClient, RecommendationClient, MovieDraftsClient, AssetsClient],
        controllers: [MoviesController, MovieDraftsController]
    })

    const assetsClient = fix.module.get(AssetsClient)
    const movieDraftsRepository = fix.module.get(MovieDraftsRepository)
    const tempDir = await Path.createTempDirectory()

    async function teardown() {
        await fix.teardown()
        await Path.delete(tempDir)
    }

    return {
        ...fix,
        teardown,
        image: fixtureFiles.image,
        tempDir,
        assetsClient,
        movieDraftsRepository
    }
}
