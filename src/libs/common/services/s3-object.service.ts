import {
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client,
    S3ClientConfig
} from '@aws-sdk/client-s3'
import { createPresignedPost, PresignedPost } from '@aws-sdk/s3-presigned-post'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { DynamicModule, Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common'
import { defaultTo } from 'lodash'
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

function normalizeContentType(v?: string): string | undefined {
    if (!v) return undefined
    return v.split(';', 1)[0].trim().toLowerCase()
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

    async presignUploadPost(opts: S3PresignPostUploadOptions): Promise<S3PresignPostUploadResult> {
        const {
            key,
            expiresInSec,
            contentType,
            minContentLength,
            maxContentLength,
            contentDisposition,
            metadata
        } = opts

        const Fields: Record<string, string> = {}
        const Conditions: any[] = []

        if (contentType) {
            Fields['Content-Type'] = contentType
            Conditions.push(['eq', '$Content-Type', contentType])
        }

        if (contentDisposition) {
            Fields['Content-Disposition'] = contentDisposition
            Conditions.push(['eq', '$Content-Disposition', contentDisposition])
        }

        if (metadata) {
            for (const [k, v] of Object.entries(metadata)) {
                Fields[`x-amz-meta-${k}`] = v
                Conditions.push(['eq', `$x-amz-meta-${k}`, v])
            }
        }

        if (typeof minContentLength === 'number' || typeof maxContentLength === 'number') {
            Conditions.push([
                'content-length-range',
                defaultTo(minContentLength, 0),
                defaultTo(maxContentLength, 1024 * 1024 * 1024 * 1024)
            ])
        }

        return createPresignedPost(this.s3, {
            Bucket: this.bucket,
            Key: key,
            Expires: expiresInSec,
            Fields,
            Conditions
        })
    }

    async presignDownloadUrl(opts: S3PresignDownloadOptions): Promise<string> {
        const { key, expiresInSec, filename, responseContentType, responseContentDisposition } =
            opts

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

    async isUploadComplete(opts: S3UploadCompleteOptions): Promise<boolean> {
        const { key, contentLength, contentType } = opts

        try {
            const { ContentLength, ContentType } = await this.s3.send(
                new HeadObjectCommand({ Bucket: this.bucket, Key: key })
            )

            if (typeof contentLength === 'number' && ContentLength !== contentLength) return false

            // Content-Type은 파라미터(예: charset) 차이가 날 수 있어 base-type으로 비교
            const expected = normalizeContentType(contentType)
            const actual = normalizeContentType(ContentType)

            if (expected && actual && expected !== actual) return false
            if (expected && !actual) return false

            return true
        } catch (error) {
            if (
                error.name === 'NotFound' ||
                error.name === 'NoSuchKey' ||
                error.$metadata?.httpStatusCode === 404
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
            .map((content) => ({
                key: defaultTo(content.Key, 'null'),
                lastModified: content.LastModified as Date,
                eTag: content.ETag?.replace(/^"+|"+$/g, ''),
                size: content.Size
            }))
            .filter((o) => o.key)

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
                const { bucket, ...s3config } = await useFactory(...args)

                const client = new S3Client(s3config)
                return new S3ObjectService(bucket, client)
            },
            inject
        }

        return { module: S3ObjectModule, providers: [provider], exports: [provider] }
    }
}
