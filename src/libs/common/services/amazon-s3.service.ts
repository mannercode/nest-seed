import {
    Bucket,
    CreateBucketCommand,
    DeleteBucketCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    ListBucketsCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { DynamicModule, Inject, Injectable, Module } from '@nestjs/common'

export type CreateBucketResult = { status: number; location: string }
export type DeleteBucketResult = { status: number; deletedBucket: string }

export type UploadOptions = { bucket: string; key: string; expiresInSec: number }
export type DownloadOptions = { bucket: string; key: string; expiresInSec: number }

export type DeleteObjectResult = { status: number; bucket: string; deletedObject: string }

export type ListObjectsOptions = {
    bucket: string
    prefix?: string
    nextToken?: string
    maxKeys?: number
}
export type S3Object = { key: string; lastModified: Date; eTag: string; size: number }
export type ListObjectsResult = {
    contents: S3Object[]
    isTruncated: boolean
    nextToken?: string
    maxKeys: number
    bucket: string
    prefix: string
}

@Injectable()
export class AmazonS3Service {
    constructor(private readonly s3: S3Client) {}

    static getServiceName(name?: string) {
        return `AmazonS3Service_${name}`
    }

    async createBucket(name: string): Promise<CreateBucketResult> {
        const command = new CreateBucketCommand({ Bucket: name })
        const { $metadata, Location } = await this.s3.send(command)

        return { status: $metadata.httpStatusCode!, location: Location! }
    }

    async listBuckets(): Promise<Bucket[]> {
        const command = new ListBucketsCommand({})
        const { Buckets } = await this.s3.send(command)

        return Buckets!
    }

    async deleteBucket(name: string): Promise<DeleteBucketResult> {
        const command = new DeleteBucketCommand({ Bucket: name })
        const { $metadata } = await this.s3.send(command)

        return { status: $metadata.httpStatusCode!, deletedBucket: name }
    }

    async presignUploadUrl(opts: UploadOptions): Promise<string> {
        const { bucket, key, expiresInSec } = opts

        const cmd = new PutObjectCommand({ Bucket: bucket, Key: key })

        const uploadUrl = await getSignedUrl(this.s3, cmd, { expiresIn: expiresInSec })
        return uploadUrl
    }

    async presignDownloadUrl(opts: DownloadOptions): Promise<string> {
        const { bucket, key, expiresInSec } = opts

        const command = new GetObjectCommand({ Bucket: bucket, Key: key })

        const downloadUrl = await getSignedUrl(this.s3, command, { expiresIn: expiresInSec })
        return downloadUrl
    }

    async deleteObject(bucket: string, key: string): Promise<DeleteObjectResult> {
        const command = new DeleteObjectCommand({ Bucket: bucket, Key: key })

        const { $metadata } = await this.s3.send(command)

        return { status: $metadata.httpStatusCode!, bucket, deletedObject: key }
    }

    async listObjects(options: ListObjectsOptions): Promise<ListObjectsResult> {
        const command = new ListObjectsV2Command({
            Bucket: options.bucket,
            Prefix: options.prefix,
            ContinuationToken: options.nextToken,
            MaxKeys: options.maxKeys
        })

        const result = await this.s3.send(command)

        let contents: S3Object[] = []

        contents = result.Contents!.map((content) => ({
            key: content.Key!,
            lastModified: content.LastModified!,
            eTag: content.ETag!,
            size: content.Size!
        }))

        return {
            contents,
            isTruncated: result.IsTruncated!,
            nextToken: result.NextContinuationToken,
            maxKeys: result.MaxKeys!,
            bucket: result.Name!,
            prefix: result.Prefix!
        }
    }
}

export function InjectAmazonS3(name?: string): ParameterDecorator {
    return Inject(AmazonS3Service.getServiceName(name))
}

export interface AmazonS3ModuleOptions {
    name?: string
    endpoint: string
    accessKeyId: string
    secretAccessKey: string
    region: string
    forcePathStyle: boolean
}

@Module({})
export class AmazonS3Module {
    static register(options: AmazonS3ModuleOptions): DynamicModule {
        const { name, endpoint, accessKeyId, secretAccessKey, region, forcePathStyle } = options

        const provider = {
            provide: AmazonS3Service.getServiceName(name),
            useFactory: async () => {
                const client = new S3Client({
                    endpoint,
                    region,
                    credentials: { accessKeyId, secretAccessKey },
                    forcePathStyle
                })
                return new AmazonS3Service(client)
            },
            inject: []
        }

        return { module: AmazonS3Module, providers: [provider], exports: [provider] }
    }
}
