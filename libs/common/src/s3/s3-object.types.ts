import type { S3ClientConfig } from '@aws-sdk/client-s3'
import type { PresignedPost } from '@aws-sdk/s3-presigned-post'
import type { ChecksumAlgorithm } from '../utils'

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
    /** 다운로드할 때 강제로 쓸 파일 이름. */
    filename?: string
    /** `Content-Disposition` 헤더를 직접 지정한다. */
    responseContentDisposition?: string
    /** 다운로드 응답의 `Content-Type`을 덮어쓴다. */
    responseContentType?: string
} & S3PresignUrlOptions

export type S3PresignPostUploadOptions = S3PresignUrlOptions & {
    /** 업로드 본문이 이 체크섬과 다르면 스토리지가 업로드 자체를 거부한다. */
    checksum?: { algorithm: ChecksumAlgorithm; base64: string }
    // 예: `attachment; filename="a.txt"`
    contentDisposition?: string
    contentType?: string
    maxContentLength?: number
    metadata?: Record<string, string>
    minContentLength?: number
}

export type S3PresignPostUploadResult = PresignedPost

export type S3PresignUrlOptions = { expiresInSec: number; key: string }

export type S3UploadCompleteOptions = { contentLength?: number; contentType?: string; key: string }
