import { S3ClientConfig } from '@aws-sdk/client-s3'
import {
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client,
    S3ServiceException
} from '@aws-sdk/client-s3'
import { PresignedPost } from '@aws-sdk/s3-presigned-post'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { DynamicModule, OnModuleDestroy } from '@nestjs/common'
import { Inject, Injectable, Module } from '@nestjs/common'
import { defaultTo, some } from 'lodash'
import { newObjectIdString } from '../mongoose'
import { HttpUtil } from '../utils'

export interface S3ServiceConfig extends S3ClientConfig {
    bucket: string
}
export type S3DeleteObjectResult = { key: string; status: number }
export type S3ListObjectsOptions = {
    delimiter?: string
    maxKeys?: number
    nextToken?: string
    prefix?: string
}
export type S3ListObjectsResult = {
    commonPrefixes?: string[]
    contents: S3ObjectSummary[]
    delimiter?: string
    isTruncated: boolean
    maxKeys?: number
    nextToken?: string
    prefix?: string
}
export type S3ObjectData = { contentType: string; data: Buffer; filename: string }
export type S3ObjectModuleOptions = {
    inject?: any[]
    name?: string
    useFactory: (...args: any[]) => Promise<S3ServiceConfig> | S3ServiceConfig
}
export type S3ObjectSummary = { eTag?: string; key: string; lastModified?: Date; size?: number }
export type S3PresignDownloadOptions = {
    /**
     * Force the download filename.
     * 다운로드 파일명 강제
     */
    filename?: string
    /**
     * Specify Content-Disposition directly.
     * Content-Disposition 직접 지정
     */
    responseContentDisposition?: string
    /**
     * Override Content-Type on download.
     * 다운로드 시 Content-Type 오버라이드
     */
    responseContentType?: string
} & S3PresignUrlOptions
export type S3PresignPostUploadOptions = S3PresignUrlOptions & {
    // ex) attachment; filename="a.txt"
    contentDisposition?: string
    contentType?: string
    maxContentLength?: number
    metadata?: Record<string, string>
    minContentLength?: number
}

export type S3PresignPostUploadResult = PresignedPost

export type S3PresignUrlOptions = { expiresInSec: number; key: string }

@Injectable()
export class S3ObjectService implements OnModuleDestroy {
    constructor(
        private readonly bucket: string,
        private readonly s3: S3Client
    ) {}

    static getName(name?: string) {
        return `S3ObjectService_${defaultTo(name, 'default')}`
    }

    async deleteObject(key: string): Promise<S3DeleteObjectResult> {
        const { $metadata } = await this.s3.send(
            new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
        )

        return { key, status: defaultTo($metadata.httpStatusCode, 200) }
    }

    async isUploadComplete(options: S3UploadCompleteOptions): Promise<boolean> {
        const { contentLength, contentType, key } = options

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

    async listObjects(options: S3ListObjectsOptions): Promise<S3ListObjectsResult> {
        const result = await this.s3.send(
            new ListObjectsV2Command({
                Bucket: this.bucket,
                ContinuationToken: options.nextToken,
                Delimiter: options.delimiter,
                MaxKeys: options.maxKeys,
                Prefix: options.prefix
            })
        )

        const contents: S3ObjectSummary[] = defaultTo(result.Contents, [])
            .filter((content) => typeof content.Key === 'string' && content.Key.length > 0)
            .map((content) => ({
                eTag: content.ETag?.replace(/^"+|"+$/g, ''),
                key: content.Key as string,
                lastModified: content.LastModified as Date,
                size: content.Size
            }))

        const commonPrefixes: string[] = defaultTo(result.CommonPrefixes, [])
            .map((cp) => cp.Prefix)
            .filter((p): p is string => typeof p === 'string' && p.length > 0)

        return {
            commonPrefixes,
            contents,
            delimiter: defaultTo(result.Delimiter, options.delimiter),
            isTruncated: Boolean(result.IsTruncated),
            maxKeys: defaultTo(result.MaxKeys, options.maxKeys),
            nextToken: defaultTo(result.NextContinuationToken, undefined),
            prefix: defaultTo(result.Prefix, options.prefix)
        }
    }

    onModuleDestroy() {
        this.s3.destroy()
    }

    async presignDownloadUrl(options: S3PresignDownloadOptions): Promise<string> {
        const { expiresInSec, filename, key, responseContentDisposition, responseContentType } =
            options

        const disposition = defaultTo(
            responseContentDisposition,
            filename ? HttpUtil.buildContentDisposition(filename) : undefined
        )

        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
            ResponseContentDisposition: disposition,
            ResponseContentType: responseContentType
        })

        return getSignedUrl(this.s3, command, { expiresIn: expiresInSec })
    }

    async presignUploadPost(
        options: S3PresignPostUploadOptions
    ): Promise<S3PresignPostUploadResult> {
        const {
            contentDisposition,
            contentType,
            expiresInSec,
            key,
            maxContentLength,
            metadata,
            minContentLength
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
            Conditions: conditions,
            Expires: expiresInSec,
            Fields: fields,
            Key: key
        })
    }

    async putObject(object: S3ObjectData): Promise<{ key: string }> {
        const key = newObjectIdString()
        const disposition = HttpUtil.buildContentDisposition(object.filename)

        await this.s3.send(
            new PutObjectCommand({
                Body: object.data,
                Bucket: this.bucket,
                ContentDisposition: disposition,
                ContentType: object.contentType,
                Key: key
            })
        )

        return { key }
    }
}

export type S3UploadCompleteOptions = { contentLength?: number; contentType?: string; key: string }

export function InjectS3Object(name?: string): ParameterDecorator {
    return Inject(S3ObjectService.getName(name))
}

/**
 * Compare Content-Type by base MIME type only (ignore params like `; charset=utf-8`).
 * Content-Type은 파라미터를 무시하고 base-type만 비교.
 * e.g. "application/json" === "application/json; charset=utf-8"
 */
function normalizeContentType(v?: string) {
    return v?.split(';', 1)[0].trim().toLowerCase()
}

@Module({})
export class S3ObjectModule {
    static register(options: S3ObjectModuleOptions): DynamicModule {
        const { name, useFactory } = options
        const inject = options.inject ?? []

        const provider = {
            inject,
            provide: S3ObjectService.getName(name),
            useFactory: async (...args: any[]) => {
                const { bucket, ...s3Config } = await useFactory(...args)

                const client = new S3Client(s3Config)
                return new S3ObjectService(bucket, client)
            }
        }

        return { exports: [provider], module: S3ObjectModule, providers: [provider] }
    }
}
