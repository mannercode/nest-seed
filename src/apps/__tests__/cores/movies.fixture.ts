import { RecommendationClient } from 'apps/applications'
import { MovieDto, MoviesClient, MoviesModule } from 'apps/cores'
import { MoviesController, StorageFilesController } from 'apps/gateway'
import { MulterConfigModule } from 'apps/gateway/modules'
import { StorageFilesClient, StorageFilesModule } from 'apps/infrastructures'
import {
    createMovie2,
    FixtureFile,
    fixtureFiles,
    HttpTestFixture,
    setupHttpTestContext
} from '../__helpers__'

export interface Fixture extends HttpTestFixture {
    image: FixtureFile
    createdMovie: MovieDto
}

export const createFixture = async () => {
    const context = await setupHttpTestContext({
        imports: [MulterConfigModule, MoviesModule, StorageFilesModule],
        providers: [MoviesClient, RecommendationClient, StorageFilesClient],
        controllers: [MoviesController, StorageFilesController]
    })

    const createdMovie = await createMovie2(context)

    return { ...context, image: fixtureFiles.image, createdMovie }
}
