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
import { createTestFixture, FixtureFile, fixtureFiles, TestFixture } from '../__helpers__'

export type MovieDraftsFixture = TestFixture & {
    image: FixtureFile
    tempDir: string
    assetsClient: AssetsClient
    movieDraftsRepository: MovieDraftsRepository
}

export async function createMovieDraftsFixture() {
    const fix = await createTestFixture({
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

// const configMock = createConfigServiceMock({
//     FILE_UPLOAD_MAX_FILE_SIZE_BYTES: localFiles.oversized.size,
//     FILE_UPLOAD_MAX_FILES_PER_UPLOAD: maxFilesPerUpload,
//     FILE_UPLOAD_ALLOWED_FILE_TYPES: 'text/plain',
//     S3_ENDPOINT: s3.endpoint,
//     S3_REGION: s3.region,
//     S3_BUCKET: s3.bucket,
//     S3_ACCESS_KEY_ID: s3.accessKeyId,
//     S3_SECRET_ACCESS_KEY: s3.secretAccessKey,
//     S3_FORCE_PATH_STYLE: s3.forcePathStyle
// })

// const fix = await createTestFixture({
//     imports: [AssetsModule],
//     providers: [AssetsClient],
//     overrideProviders: [configMock]
// })
