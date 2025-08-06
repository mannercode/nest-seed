import { RecommendationClient } from 'apps/applications'
import { MovieDto, MoviesClient, MoviesModule } from 'apps/cores'
import { MoviesController, StorageFilesController } from 'apps/gateway'
import { MulterConfigModule } from 'apps/gateway/modules'
import { StorageFilesClient, StorageFilesModule } from 'apps/infrastructures'
import {
    createMovie2,
    FixtureFile,
    fixtureFiles,
    TestFixture,
    createTestFixture
} from '../__helpers__'

export interface Fixture extends TestFixture {
    image: FixtureFile
    createdMovie: MovieDto
}

export const createFixture = async () => {
    const fix = await createTestFixture({
        imports: [MulterConfigModule, MoviesModule, StorageFilesModule],
        providers: [MoviesClient, RecommendationClient, StorageFilesClient],
        controllers: [MoviesController, StorageFilesController]
    })

    const createdMovie = await createMovie2(fix)

    return { ...fix, image: fixtureFiles.image, createdMovie }
}
