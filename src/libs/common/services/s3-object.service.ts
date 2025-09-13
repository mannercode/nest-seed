import {
    DeleteObjectCommand,
    GetObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { DynamicModule, Inject, Injectable, Module } from '@nestjs/common'
import { Readable } from 'stream'
import { newObjectId } from '../mongoose'
import { HttpUtil } from '../utils'

export type S3Object = { data: Buffer; filename: string; contentType: string }

export type S3UploadOptions = { key: string; expiresInSec: number }
export type S3DownloadOptions = { key: string; expiresInSec: number }

export type S3DeleteObjectResult = { status: number; deletedObject: string }

export type S3ListObjectsOptions = { prefix?: string; nextToken?: string; maxKeys?: number }
export type S3ObjectSummary = { key: string; lastModified: Date; eTag: string; size: number }
export type S3ListObjectsResult = {
    contents: S3ObjectSummary[]
    isTruncated: boolean
    nextToken?: string
    maxKeys: number
    prefix: string
}

@Injectable()
export class S3ObjectService {
    constructor(
        private readonly bucket: string,
        private readonly s3: S3Client
    ) {}

    static getServiceName(name?: string) {
        return `S3ObjectService_${name}`
    }

    async presignUploadUrl(opts: S3UploadOptions): Promise<string> {
        const { key, expiresInSec } = opts

        const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: key })

        const uploadUrl = await getSignedUrl(this.s3, cmd, { expiresIn: expiresInSec })
        return uploadUrl
    }

    async presignDownloadUrl(opts: S3DownloadOptions): Promise<string> {
        const { key, expiresInSec } = opts

        const command = new GetObjectCommand({ Bucket: this.bucket, Key: key })

        const downloadUrl = await getSignedUrl(this.s3, command, { expiresIn: expiresInSec })
        return downloadUrl
    }

    async putObject(object: S3Object): Promise<{ fileId: string }> {
        const fileId = newObjectId()
        const disposition = HttpUtil.buildContentDisposition(object.filename)

        await this.s3.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: fileId,
                Body: object.data,
                ContentType: object.contentType,
                ContentDisposition: disposition
            })
        )

        return { fileId }
    }

    async getObject(key: string): Promise<S3Object> {
        const { Body, ContentType, ContentDisposition } = await this.s3.send(
            new GetObjectCommand({ Bucket: this.bucket, Key: key })
        )

        let data = Buffer.from([])

        const chunks: Buffer[] = []

        for await (const chunk of Body as Readable) {
            chunks.push(chunk)
        }

        data = Buffer.concat(chunks)

        const contentType = ContentType!
        const filename = HttpUtil.extractContentDisposition(ContentDisposition!)

        return { data, filename, contentType }
    }

    async deleteObject(key: string): Promise<S3DeleteObjectResult> {
        const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: key })

        const { $metadata } = await this.s3.send(command)

        return { status: $metadata.httpStatusCode!, deletedObject: key }
    }

    async listObjects(options: S3ListObjectsOptions): Promise<S3ListObjectsResult> {
        const command = new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: options.prefix,
            ContinuationToken: options.nextToken,
            MaxKeys: options.maxKeys
        })

        const result = await this.s3.send(command)

        let contents: S3ObjectSummary[] = []

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
            prefix: result.Prefix!
        }
    }
}

export function InjectS3Object(name?: string): ParameterDecorator {
    return Inject(S3ObjectService.getServiceName(name))
}

type S3ObjectFactoryOptions = {
    endpoint: string
    accessKeyId: string
    secretAccessKey: string
    region: string
    bucket: string
    forcePathStyle: boolean
}

export interface S3ObjectModuleOptions {
    name?: string
    useFactory: (...args: any[]) => Promise<S3ObjectFactoryOptions> | S3ObjectFactoryOptions
    inject?: any[]
}

@Module({})
export class S3ObjectModule {
    static register(options: S3ObjectModuleOptions): DynamicModule {
        const { name, useFactory, inject } = options

        const provider = {
            provide: S3ObjectService.getServiceName(name),
            useFactory: async (...args: any[]) => {
                const { endpoint, accessKeyId, secretAccessKey, region, bucket, forcePathStyle } =
                    await useFactory(...args)

                const client = new S3Client({
                    endpoint,
                    region,
                    credentials: { accessKeyId, secretAccessKey },
                    forcePathStyle
                })
                return new S3ObjectService(bucket, client)
            },
            inject
        }

        return { module: S3ObjectModule, providers: [provider], exports: [provider] }
    }
}
