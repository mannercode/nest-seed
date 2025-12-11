import { RecommendationClient } from 'apps/applications'
import { MovieDto, MoviesClient, MoviesModule } from 'apps/cores'
import { MoviesController } from 'apps/gateway'
import { AssetsClient, AssetsModule } from 'apps/infrastructures'
import {
    createMovie,
    createTestFixture,
    FixtureFile,
    fixtureFiles,
    TestFixture,
    uploadFile
} from '../__helpers__'

export type MoviesFixture = TestFixture & {
    createdMovie: MovieDto
    assetsClient: AssetsClient
    image: FixtureFile
    imageAssetId: string
}

export async function createMoviesFixture() {
    const fix = await createTestFixture({
        imports: [MoviesModule, AssetsModule],
        providers: [MoviesClient, RecommendationClient, AssetsClient],
        controllers: [MoviesController]
    })

    const image = fixtureFiles.image
    const imageAssetId = await uploadFile(fix, image)
    const imageAssetIds = [imageAssetId]

    const assetsClient = fix.module.get(AssetsClient)
    const createdMovie = await createMovie(fix, { imageAssetIds })

    return { ...fix, image: fixtureFiles.image, createdMovie, assetsClient, imageAssetId }
}
