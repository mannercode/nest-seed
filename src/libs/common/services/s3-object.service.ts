import { Readable } from 'stream'
import {
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    PutObjectCommandInput,
    S3Client,
    S3ClientConfig
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { DynamicModule, Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common'
import { newObjectId } from '../mongoose'
import { HttpUtil } from '../utils'
import { Or } from '../validator'

export type S3PresignUrlOptions = { key: string; expiresInSec: number }
export type S3PresignUploadOptions = S3PresignUrlOptions & {
    contentType?: string
    contentLength?: number
}
export type S3UploadCompleteOptions = { key: string; contentType?: string; contentLength?: number }
export type S3ObjectData = { data: Buffer; filename: string; contentType: string }
export type S3DeleteObjectResult = { status: number; key: string }
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
export class S3ObjectService implements OnModuleDestroy {
    constructor(
        private readonly bucket: string,
        private readonly s3: S3Client
    ) {}

    static getName(name?: string) {
        return `S3ObjectService_${Or(name, 'default')}`
    }

    onModuleDestroy() {
        this.s3.destroy()
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

    async presignDownloadUrl(opts: S3PresignUrlOptions): Promise<string> {
        const { key, expiresInSec } = opts

        const command = new GetObjectCommand({ Bucket: this.bucket, Key: key })

        const downloadUrl = await getSignedUrl(this.s3, command, { expiresIn: expiresInSec })
        return downloadUrl
    }

    async isUploadComplete(opts: S3UploadCompleteOptions): Promise<boolean> {
        const { key, contentLength, contentType } = opts

        try {
            const { ContentLength, ContentType } = await this.s3.send(
                new HeadObjectCommand({ Bucket: this.bucket, Key: key })
            )

            if (typeof contentLength === 'number' && ContentLength !== contentLength) {
                return false
            }

            if (typeof contentType === 'string' && ContentType !== contentType) {
                return false
            }

            return true
        } catch (error) {
            const err = error as { name?: string; $metadata?: { httpStatusCode?: number } }

            if (
                err.name === 'NotFound' ||
                err.name === 'NoSuchKey' ||
                err.$metadata?.httpStatusCode === 404
            ) {
                return false
            }

            throw error
        }
    }

    async putObject(object: S3ObjectData): Promise<{ key: string }> {
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

    async getObject(key: string): Promise<S3ObjectData> {
        const { Body, ContentType, ContentDisposition } = await this.s3.send(
            new GetObjectCommand({ Bucket: this.bucket, Key: key })
        )

        const chunks: Buffer[] = []

        for await (const chunk of Body as Readable) {
            chunks.push(chunk)
        }

        const objectData = Buffer.concat(chunks)

        const contentType = Or(ContentType, 'application/octet-stream')

        const filename = HttpUtil.extractContentDisposition(
            Or(ContentDisposition, `filename=${key}`)
        )

        return { data: objectData, filename, contentType }
    }

    async deleteObject(key: string): Promise<S3DeleteObjectResult> {
        const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: key })

        const { $metadata } = await this.s3.send(command)
        const status = Or($metadata.httpStatusCode, 200)

        return { status, key }
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

        let contents: S3ObjectSummary[] = Or(result.Contents, [])
            .map((content) => ({
                key: Or(content.Key, 'null'),
                lastModified: content.LastModified as Date,
                eTag: content.ETag as string,
                size: content.Size as number
            }))
            .filter((o) => o.key)

        const commonPrefixes: string[] = Or(result.CommonPrefixes, [])
            .map((cp) => cp.Prefix)
            .filter((p): p is string => !!p && p.length > 0)

        return {
            contents,
            commonPrefixes,
            isTruncated: Boolean(result.IsTruncated),
            nextToken: Or(result.NextContinuationToken, undefined),
            maxKeys: result.MaxKeys,
            prefix: Or(result.Prefix, options.prefix),
            delimiter: Or(result.Delimiter, options.delimiter)
        }
    }
}

export function InjectS3Object(name?: string): ParameterDecorator {
    return Inject(S3ObjectService.getName(name))
}

/**
 * AWS S3는 기본적으로 false. MinIO 사용 시 path-style 주소를 위해 true가 필요할 수 있음
 * Default is false for AWS S3. May need true for MinIO to use path-style addressing
 */
export interface S3ClientFactoryConfig extends S3ClientConfig {
    bucket: string
}

export type S3ObjectModuleOptions = {
    name?: string
    useFactory: (...args: any[]) => Promise<S3ClientFactoryConfig> | S3ClientFactoryConfig
    inject?: any[]
}

@Module({})
export class S3ObjectModule {
    static register(options: S3ObjectModuleOptions): DynamicModule {
        const { name, useFactory, inject } = options

        const provider = {
            provide: S3ObjectService.getName(name),
            useFactory: async (...args: any[]) => {
                const { bucket, ...s3config } = await useFactory(...args)

                const client = new S3Client(s3config)

                return new S3ObjectService(bucket, client)
            },
            inject
        }

        return { module: S3ObjectModule, providers: [provider], exports: [provider] }
    }
}
