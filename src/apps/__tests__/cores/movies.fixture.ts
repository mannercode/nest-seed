import { RecommendationClient } from 'apps/applications'
import { MovieDto, MoviesClient, MoviesModule } from 'apps/cores'
import { MoviesController, StorageFilesController } from 'apps/gateway'
import { StorageFilesClient, StorageFilesModule } from 'apps/infrastructures'
import { Path } from 'common'
import {
    createMovie,
    createTestFixture,
    FixtureFile,
    fixtureFiles,
    TestFixture
} from '../__helpers__'
import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3'
import { getS3TestConnection } from 'testlib'

export interface Fixture extends TestFixture {
    image: FixtureFile
    createdMovie: MovieDto
    tempDir: string
}

export const createFixture = async () => {
    await ensureS3Bucket()

    const fix = await createTestFixture({
        imports: [MoviesModule, StorageFilesModule],
        providers: [MoviesClient, RecommendationClient, StorageFilesClient],
        controllers: [MoviesController, StorageFilesController]
    })

    const tempDir = await Path.createTempDirectory()

    const createdMovie = await createMovie(fix)

    const teardown = async () => {
        await fix.teardown()
        await Path.delete(tempDir)
    }

    return { ...fix, teardown, image: fixtureFiles.image, createdMovie, tempDir }
}

const ensureS3Bucket = async () => {
    const { endpoint, region, accessKeyId, secretAccessKey, forcePathStyle, bucket } =
        getS3TestConnection()

    const client = new S3Client({
        endpoint,
        region,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle
    })

    try {
        await client.send(new CreateBucketCommand({ Bucket: bucket }))
    } catch (error: any) {
        if (error?.name !== 'BucketAlreadyOwnedByYou' && error?.$metadata?.httpStatusCode !== 409) {
            throw error
        }
    }
}
