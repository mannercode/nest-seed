import {
    DeleteObjectCommand,
    GetObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    PutObjectCommandInput,
    S3Client
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { DynamicModule, Inject, Injectable, Module } from '@nestjs/common'
import { Readable } from 'stream'
import { newObjectId } from '../mongoose'
import { HttpUtil } from '../utils'

export type PresignedUrl = { url: string; key: string; expiresAt: Date }
export type S3PresignOptions = { key: string; expiresInSec: number }
export type S3PresignUploadOptions = S3PresignOptions & {
    contentType?: string
    contentLength?: number
}

export type S3Object = { data: Buffer; filename: string; contentType: string }

export type S3DeleteObjectResult = { status: number; deletedObject: string }

export type S3ListObjectsOptions = {
    prefix?: string
    nextToken?: string
    maxKeys?: number
    delimiter?: string
}
export type S3ObjectSummary = { key: string; lastModified: Date; eTag: string; size: number }
export type S3ListObjectsResult = {
    contents: S3ObjectSummary[]
    commonPrefixes?: string[]
    isTruncated: boolean
    nextToken?: string
    maxKeys?: number
    prefix?: string
    delimiter?: string
}

@Injectable()
export class S3ObjectService {
    constructor(
        private readonly bucket: string,
        private readonly s3: S3Client
    ) {}

    static getName(name: string = 'default') {
        return `S3ObjectService_${name}`
    }

    async presignUploadUrl(opts: S3PresignUploadOptions): Promise<string> {
        const { key, expiresInSec, contentType, contentLength } = opts

        const signableHeaders = new Set<string>()
        const params: PutObjectCommandInput = { Bucket: this.bucket, Key: key }

        if (contentType) {
            params.ContentType = contentType
            signableHeaders.add('content-type')
        }

        if (typeof contentLength === 'number') {
            params.ContentLength = contentLength
            signableHeaders.add('content-length')
        }

        const command = new PutObjectCommand(params)

        const uploadUrl = await getSignedUrl(this.s3, command, {
            expiresIn: expiresInSec,
            signableHeaders
        })

        return uploadUrl
    }

    async presignDownloadUrl(opts: S3PresignOptions): Promise<string> {
        const { key, expiresInSec } = opts

        const command = new GetObjectCommand({ Bucket: this.bucket, Key: key })

        const downloadUrl = await getSignedUrl(this.s3, command, { expiresIn: expiresInSec })
        return downloadUrl
    }

    async putObject(object: S3Object): Promise<{ key: string }> {
        const key = newObjectId()
        const disposition = HttpUtil.buildContentDisposition(object.filename)

        await this.s3.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: object.data,
                ContentType: object.contentType,
                ContentDisposition: disposition
            })
        )

        return { key }
    }

    async getObject(key: string): Promise<S3Object> {
        const { Body, ContentType, ContentDisposition } = await this.s3.send(
            new GetObjectCommand({ Bucket: this.bucket, Key: key })
        )

        let objectData = Buffer.from([])

        const chunks: Buffer[] = []

        for await (const chunk of Body as Readable) {
            chunks.push(chunk)
        }

        objectData = Buffer.concat(chunks)

        /* istanbul ignore next */
        const contentType = ContentType ?? 'application/octet-stream'
        /* istanbul ignore next */
        const filename = ContentDisposition
            ? HttpUtil.extractContentDisposition(ContentDisposition)
            : key

        return { data: objectData, filename, contentType }
    }

    async deleteObject(key: string): Promise<S3DeleteObjectResult> {
        const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: key })

        const { $metadata } = await this.s3.send(command)
        /* istanbul ignore next */
        const status = $metadata.httpStatusCode ?? 200

        return { status, deletedObject: key }
    }

    async listObjects(options: S3ListObjectsOptions): Promise<S3ListObjectsResult> {
        const command = new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: options.prefix,
            ContinuationToken: options.nextToken,
            MaxKeys: options.maxKeys,
            Delimiter: options.delimiter
        })

        const result = await this.s3.send(command)

        let contents: S3ObjectSummary[] = (result.Contents ?? [])
            .map((content) => ({
                key: content.Key!,
                lastModified: content.LastModified as Date,
                eTag: content.ETag as string,
                size: content.Size as number
            }))
            .filter((o) => o.key)

        const commonPrefixes: string[] = (result.CommonPrefixes ?? [])
            .map((cp) => cp.Prefix)
            .filter((p): p is string => !!p && p.length > 0)

        return {
            contents,
            commonPrefixes,
            isTruncated: Boolean(result.IsTruncated),
            nextToken: result.NextContinuationToken || undefined,
            maxKeys: result.MaxKeys,
            prefix: result.Prefix || options.prefix,
            delimiter: result.Delimiter || options.delimiter
        }
    }
}

export function InjectS3Object(name?: string): ParameterDecorator {
    return Inject(S3ObjectService.getName(name))
}

type S3ObjectFactoryOptions = {
    endpoint: string
    accessKeyId: string
    secretAccessKey: string
    region: string
    bucket: string
    forcePathStyle: boolean
}

export type S3ObjectModuleOptions = {
    name?: string
    useFactory: (...args: any[]) => Promise<S3ObjectFactoryOptions> | S3ObjectFactoryOptions
    inject?: any[]
}

@Module({})
export class S3ObjectModule {
    static register(options: S3ObjectModuleOptions): DynamicModule {
        const { name, useFactory, inject } = options

        const provider = {
            provide: S3ObjectService.getName(name),
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
