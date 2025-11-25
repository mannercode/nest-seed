import { RecommendationClient } from 'apps/applications'
import { MovieDto, MoviesClient, MoviesModule } from 'apps/cores'
import { MoviesController, StorageFilesController } from 'apps/gateway'
import { MulterConfigModule } from 'apps/gateway/modules'
import { StorageFilesClient, StorageFilesModule } from 'apps/infrastructures'
import { Path } from 'common'
import {
    createMovie,
    createTestFixture,
    FixtureFile,
    fixtureFiles,
    TestFixture
} from '../__helpers__'

export interface Fixture extends TestFixture {
    image: FixtureFile
    createdMovieCreation: MovieDto
    tempDir: string
}

export const createFixture = async () => {
    const fix = await createTestFixture({
        imports: [MulterConfigModule, MoviesModule, StorageFilesModule],
        providers: [MoviesClient, RecommendationClient, StorageFilesClient],
        controllers: [MoviesController, StorageFilesController]
    })

    const tempDir = await Path.createTempDirectory()

    const createdMovieCreation = await createMovie(fix)

    const teardown = async () => {
        await fix.teardown()
        await Path.delete(tempDir)
    }

    return { ...fix, teardown, image: fixtureFiles.image, createdMovieCreation, tempDir }
}
