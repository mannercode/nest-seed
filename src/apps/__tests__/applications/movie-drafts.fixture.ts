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
import { createAppTestContext, FixtureFile, fixtureFiles, AppTestContext } from '../__helpers__'

export type MovieDraftsFixture = AppTestContext & {
    image: FixtureFile
    tempDir: string
    assetsClient: AssetsClient
    movieDraftsRepository: MovieDraftsRepository
}

export async function createMovieDraftsFixture() {
    const ctx = await createAppTestContext({
        imports: [MoviesModule, AssetsModule, MovieDraftsModule],
        providers: [MoviesClient, RecommendationClient, MovieDraftsClient, AssetsClient],
        controllers: [MoviesController, MovieDraftsController]
    })

    const assetsClient = ctx.module.get(AssetsClient)
    const movieDraftsRepository = ctx.module.get(MovieDraftsRepository)
    const tempDir = await Path.createTempDirectory()

    async function teardown() {
        await ctx.teardown()
        await Path.delete(tempDir)
    }

    return {
        ...ctx,
        teardown,
        image: fixtureFiles.image,
        tempDir,
        assetsClient,
        movieDraftsRepository
    }
}
