import { RecommendationClient } from 'apps/applications'
import { MovieDto, MoviesClient, MoviesModule } from 'apps/cores'
import { AttachmentsController, MoviesController } from 'apps/gateway'
import { AttachmentsClient, AttachmentsModule } from 'apps/infrastructures'
import { Path } from 'common'
import {
    createMovie,
    createTestFixture,
    ensureS3Bucket,
    FixtureFile,
    fixtureFiles,
    TestFixture
} from '../__helpers__'

export interface Fixture extends TestFixture {
    image: FixtureFile
    createdMovie: MovieDto
    tempDir: string
}

export const createFixture = async () => {
    await ensureS3Bucket()

    const fix = await createTestFixture({
        imports: [MoviesModule, AttachmentsModule],
        providers: [MoviesClient, RecommendationClient, AttachmentsClient],
        controllers: [MoviesController, AttachmentsController]
    })

    const tempDir = await Path.createTempDirectory()

    const createdMovie = await createMovie(fix)

    const teardown = async () => {
        await fix.teardown()
        await Path.delete(tempDir)
    }

    return { ...fix, teardown, image: fixtureFiles.image, createdMovie, tempDir }
}
