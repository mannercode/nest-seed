import {
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client,
    S3ClientConfig,
    S3ServiceException
} from '@aws-sdk/client-s3'
import { createPresignedPost, PresignedPost } from '@aws-sdk/s3-presigned-post'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { DynamicModule, Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common'
import { defaultTo, some } from 'lodash'
import { newObjectIdString } from '../mongoose'
import { HttpUtil } from '../utils'

export type S3PresignUrlOptions = { key: string; expiresInSec: number }
export type S3PresignPostUploadOptions = S3PresignUrlOptions & {
    contentType?: string
    minContentLength?: number
    maxContentLength?: number
    // attachment; filename="a.txt"
    contentDisposition?: string
    metadata?: Record<string, string>
}
export type S3PresignPostUploadResult = PresignedPost
export type S3UploadCompleteOptions = { key: string; contentType?: string; contentLength?: number }
export type S3ObjectData = { data: Buffer; filename: string; contentType: string }
export type S3DeleteObjectResult = { status: number; key: string }
export type S3ListObjectsOptions = {
    prefix?: string
    nextToken?: string
    maxKeys?: number
    delimiter?: string
}
export type S3ObjectSummary = { key: string; lastModified?: Date; eTag?: string; size?: number }
export type S3ListObjectsResult = {
    contents: S3ObjectSummary[]
    commonPrefixes?: string[]
    isTruncated: boolean
    nextToken?: string
    maxKeys?: number
    prefix?: string
    delimiter?: string
}

export type S3PresignDownloadOptions = S3PresignUrlOptions & {
    /** 다운로드 파일명 강제 */
    filename?: string
    /** 다운로드 시 Content-Type 오버라이드 */
    responseContentType?: string
    /** Content-Disposition 직접 지정 */
    responseContentDisposition?: string
}

/**
 * Compare Content-Type by base MIME type only (ignore params like `; charset=utf-8`).
 * Content-Type은 파라미터를 무시하고 base-type만 비교.
 * e.g. "application/json" === "application/json; charset=utf-8"
 */
function normalizeContentType(v?: string) {
    return v?.split(';', 1)[0].trim().toLowerCase()
}

@Injectable()
export class S3ObjectService implements OnModuleDestroy {
    constructor(
        private readonly bucket: string,
        private readonly s3: S3Client
    ) {}

    static getName(name?: string) {
        return `S3ObjectService_${defaultTo(name, 'default')}`
    }

    onModuleDestroy() {
        this.s3.destroy()
    }

    async presignUploadPost(
        options: S3PresignPostUploadOptions
    ): Promise<S3PresignPostUploadResult> {
        const {
            key,
            expiresInSec,
            contentType,
            minContentLength,
            maxContentLength,
            contentDisposition,
            metadata
        } = options

        const fields: Record<string, string> = {}
        const conditions: any[] = []

        if (contentType) {
            fields['Content-Type'] = contentType
            conditions.push(['eq', '$Content-Type', contentType])
        }

        if (contentDisposition) {
            fields['Content-Disposition'] = contentDisposition
            conditions.push(['eq', '$Content-Disposition', contentDisposition])
        }

        if (metadata) {
            for (const [k, v] of Object.entries(metadata)) {
                fields[`x-amz-meta-${k}`] = v
                conditions.push(['eq', `$x-amz-meta-${k}`, v])
            }
        }

        if (typeof minContentLength === 'number' || typeof maxContentLength === 'number') {
            conditions.push([
                'content-length-range',
                defaultTo(minContentLength, 0),
                defaultTo(maxContentLength, 1024 * 1024 * 1024 * 1024)
            ])
        }

        return createPresignedPost(this.s3, {
            Bucket: this.bucket,
            Key: key,
            Expires: expiresInSec,
            Fields: fields,
            Conditions: conditions
        })
    }

    async presignDownloadUrl(options: S3PresignDownloadOptions): Promise<string> {
        const { key, expiresInSec, filename, responseContentType, responseContentDisposition } =
            options

        const disposition = defaultTo(
            responseContentDisposition,
            filename ? HttpUtil.buildContentDisposition(filename) : undefined
        )

        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
            ResponseContentType: responseContentType,
            ResponseContentDisposition: disposition
        })

        return getSignedUrl(this.s3, command, { expiresIn: expiresInSec })
    }

    async isUploadComplete(options: S3UploadCompleteOptions): Promise<boolean> {
        const { key, contentLength, contentType } = options

        try {
            const { ContentLength, ContentType } = await this.s3.send(
                new HeadObjectCommand({ Bucket: this.bucket, Key: key })
            )

            if (typeof contentLength === 'number' && ContentLength !== contentLength) return false

            const expected = normalizeContentType(contentType)
            const actual = normalizeContentType(ContentType)

            if (expected && actual && expected !== actual) return false
            if (expected && !actual) return false

            return true
        } catch (error) {
            if (
                error instanceof S3ServiceException &&
                some([
                    error.name === 'NotFound',
                    error.name === 'NoSuchKey',
                    error.$metadata.httpStatusCode === 404
                ])
            ) {
                return false
            }

            throw error
        }
    }

    async putObject(object: S3ObjectData): Promise<{ key: string }> {
        const key = newObjectIdString()
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

    async deleteObject(key: string): Promise<S3DeleteObjectResult> {
        const { $metadata } = await this.s3.send(
            new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
        )

        return { status: defaultTo($metadata.httpStatusCode, 200), key }
    }

    async listObjects(options: S3ListObjectsOptions): Promise<S3ListObjectsResult> {
        const result = await this.s3.send(
            new ListObjectsV2Command({
                Bucket: this.bucket,
                Prefix: options.prefix,
                ContinuationToken: options.nextToken,
                MaxKeys: options.maxKeys,
                Delimiter: options.delimiter
            })
        )

        const contents: S3ObjectSummary[] = defaultTo(result.Contents, [])
            .filter((content) => typeof content.Key === 'string' && content.Key.length > 0)
            .map((content) => ({
                key: content.Key as string,
                lastModified: content.LastModified as Date,
                eTag: content.ETag?.replace(/^"+|"+$/g, ''),
                size: content.Size
            }))

        const commonPrefixes: string[] = defaultTo(result.CommonPrefixes, [])
            .map((cp) => cp.Prefix)
            .filter((p): p is string => typeof p === 'string' && p.length > 0)

        return {
            contents,
            commonPrefixes,
            isTruncated: Boolean(result.IsTruncated),
            nextToken: defaultTo(result.NextContinuationToken, undefined),
            maxKeys: defaultTo(result.MaxKeys, options.maxKeys),
            prefix: defaultTo(result.Prefix, options.prefix),
            delimiter: defaultTo(result.Delimiter, options.delimiter)
        }
    }
}

export function InjectS3Object(name?: string): ParameterDecorator {
    return Inject(S3ObjectService.getName(name))
}

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
        const { name, useFactory } = options
        const inject = options.inject ?? []

        const provider = {
            provide: S3ObjectService.getName(name),
            useFactory: async (...args: any[]) => {
                const { bucket, ...s3Config } = await useFactory(...args)

                const client = new S3Client(s3Config)
                return new S3ObjectService(bucket, client)
            },
            inject
        }

        return { module: S3ObjectModule, providers: [provider], exports: [provider] }
    }
}
