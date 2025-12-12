import { RecommendationClient } from 'apps/applications'
import { MovieDto, MoviesClient, MoviesModule } from 'apps/cores'
import { MoviesController } from 'apps/gateway'
import { AssetDto, AssetsClient, AssetsModule } from 'apps/infrastructures'
import {
    createMovie,
    createTestFixture,
    FixtureFile,
    fixtureFiles,
    TestFixture,
    uploadComplete
} from '../__helpers__'

export type MoviesFixture = TestFixture & {
    createdMovie: MovieDto
    assetsClient: AssetsClient
    image: FixtureFile
    asset: AssetDto
}

export async function createMoviesFixture() {
    const fix = await createTestFixture({
        imports: [MoviesModule, AssetsModule],
        providers: [MoviesClient, RecommendationClient, AssetsClient],
        controllers: [MoviesController]
    })

    const image = fixtureFiles.image
    const asset = await uploadComplete(fix, image)
    const assetIds = [asset.id]

    const assetsClient = fix.module.get(AssetsClient)
    const createdMovie = await createMovie(fix, { assetIds })
    createdMovie.imageUrls = expect.any(Array)

    return { ...fix, image: fixtureFiles.image, createdMovie, assetsClient, asset }
}
