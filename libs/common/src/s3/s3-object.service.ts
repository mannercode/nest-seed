import {
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client
} from '@aws-sdk/client-s3'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { HttpUtil, defaultTo, getByPath } from '../utils'
import {
    S3DeleteObjectResult,
    S3ListObjectsOptions,
    S3ListObjectsResult,
    S3ObjectData,
    S3ObjectSummary,
    S3PresignDownloadOptions,
    S3PresignPostUploadOptions,
    S3PresignPostUploadResult,
    S3UploadCompleteOptions
} from './s3-object.types'

// S3가 content-length-range의 상한을 요구하므로 하한 전용 정책에는 사실상 무제한 값을 쓴다.
const UNBOUNDED_CONTENT_LENGTH = 1024 * 1024 * 1024 * 1024 // 1 TiB

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
        } catch (error: unknown) {
            if (getByPath(error, '$metadata.httpStatusCode') === 404) {
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
            checksum,
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

        if (checksum) {
            // x-amz-checksum-* 필드가 있으면 스토리지가 업로드 본문을 직접 대조한다.
            // 정책 조건은 클라이언트가 필드를 빼고 보내는 우회를 막는다.
            const checksumField = `x-amz-checksum-${checksum.algorithm}`
            fields[checksumField] = checksum.base64
            conditions.push(['eq', `$${checksumField}`, checksum.base64])
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
                defaultTo(maxContentLength, UNBOUNDED_CONTENT_LENGTH)
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
        const key = randomUUID()
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

/**
 * Content-Type 비교는 기본 타입만 본다.
 * `; charset=utf-8` 같은 부가 파라미터는 무시한다.
 * 예: `application/json`과 `application/json; charset=utf-8`은 같다고 본다.
 */
function normalizeContentType(v?: string) {
    return v?.replace(/;.*/, '').trim().toLowerCase()
}
