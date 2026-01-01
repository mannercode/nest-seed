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
import { newObjectId } from '../mongoose'
import { HttpUtil } from '../utils'
import { Or } from '../validator'

export type S3PresignUrlOptions = { key: string; expiresInSec: number }

export type S3PresignPostUploadOptions = S3PresignUrlOptions & {
    contentType?: string
    minContentLength?: number
    maxContentLength?: number
    /** Content-Disposition(예: attachment; filename="a.txt") */
    contentDisposition?: string
    /** 추가 고정 메타데이터(정책에 포함) */
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

function isS3NotFoundError(error: unknown): boolean {
    const err = error as { name?: string; $metadata?: { httpStatusCode?: number } }
    return (
        err.name === 'NotFound' || err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404
    )
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
        return `S3ObjectService_${Or(name, 'default')}`
    }

    onModuleDestroy() {
        this.s3.destroy()
    }

    /**
     * presigned POST 업로드 정책(크기 제한 포함 가능)
     * - 브라우저 직접 업로드에 권장
     * - content-length-range 정책으로 크기 제한을 강제할 수 있음
     */
    async presignUploadUrl(opts: S3PresignPostUploadOptions): Promise<S3PresignPostUploadResult> {
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
        if (contentType) Fields['Content-Type'] = contentType
        if (contentDisposition) Fields['Content-Disposition'] = contentDisposition
        if (metadata) {
            for (const [k, v] of Object.entries(metadata)) {
                Fields[`x-amz-meta-${k}`] = v
            }
        }

        const Conditions: any[] = []
        if (contentType) Conditions.push(['eq', '$Content-Type', contentType])
        if (contentDisposition) Conditions.push(['eq', '$Content-Disposition', contentDisposition])
        if (metadata) {
            for (const [k, v] of Object.entries(metadata)) {
                Conditions.push(['eq', `$x-amz-meta-${k}`, v])
            }
        }

        if (typeof minContentLength === 'number' || typeof maxContentLength === 'number') {
            Conditions.push([
                'content-length-range',
                Or(minContentLength, 0),
                Or(maxContentLength, 5 * 1024 * 1024 * 1024) // 기본 5GiB
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

    /**
     * presigned GET 다운로드 URL
     * - filename/Content-Type 오버라이드 지원(브라우저 다운로드 UX 개선)
     */
    async presignDownloadUrl(opts: S3PresignDownloadOptions): Promise<string> {
        const { key, expiresInSec, filename, responseContentType, responseContentDisposition } =
            opts

        const disposition = Or(
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
            if (isS3NotFoundError(error)) return false
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

    async deleteObject(key: string): Promise<S3DeleteObjectResult> {
        const { $metadata } = await this.s3.send(
            new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
        )

        return { status: Or($metadata.httpStatusCode, 200), key }
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

        const contents: S3ObjectSummary[] = Or(result.Contents, [])
            .map((content) => ({
                key: Or(content.Key, 'null'),
                lastModified: content.LastModified as Date,
                eTag: content.ETag?.replace(/^"+|"+$/g, ''),
                size: content.Size
            }))
            .filter((o) => o.key)

        const commonPrefixes: string[] = Or(result.CommonPrefixes, [])
            .map((cp) => cp.Prefix)
            .filter((p): p is string => typeof p === 'string' && p.length > 0)

        return {
            contents,
            commonPrefixes,
            isTruncated: Boolean(result.IsTruncated),
            nextToken: Or(result.NextContinuationToken, undefined),
            maxKeys: Or(result.MaxKeys, options.maxKeys),
            prefix: Or(result.Prefix, options.prefix),
            delimiter: Or(result.Delimiter, options.delimiter)
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
