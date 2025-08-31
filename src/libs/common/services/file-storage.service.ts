import {
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand,
    S3Client
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { DynamicModule, Inject, Injectable, Module } from '@nestjs/common'
import { Readable } from 'stream'
import { newObjectId } from '../mongoose'
import { HttpUtil } from '../utils'

export type FileObject = { data: Buffer; filename: string; contentType: string }

export const FileStorageErrors = {
    FileNotFound: { code: 'ERR_FILE_STORAGE_DOCUMENT_NOT_FOUND', message: 'File not found' }
}

@Injectable()
export class FileStorageService {
    constructor(
        private readonly bucket: string,
        private readonly s3: S3Client
    ) {}

    static getServiceName(name?: string) {
        return `FileStorageService_${name ?? 'default'}`
    }

    async putFile(file: FileObject): Promise<{ fileId: string }> {
        const fileId = newObjectId()
        const disposition = HttpUtil.buildContentDisposition(file.filename)

        await this.s3.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: fileId,
                Body: file.data,
                ContentType: file.contentType,
                ContentDisposition: disposition
            })
        )

        return { fileId }
    }

    async getFile(fileId: string): Promise<FileObject> {
        const { Body, ContentType, ContentDisposition } = await this.s3.send(
            new GetObjectCommand({ Bucket: this.bucket, Key: fileId })
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

    async deleteFile(fileId: string): Promise<void> {
        await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: fileId }))
    }

    async createDownloadUrl(fileId: string, expiresInSec = 600): Promise<string> {
        const command = new GetObjectCommand({ Bucket: this.bucket, Key: fileId })

        const downloadUrl = await getSignedUrl(this.s3, command, { expiresIn: expiresInSec })
        return downloadUrl
    }
}

export function InjectFileStorage(name?: string): ParameterDecorator {
    return Inject(FileStorageService.getServiceName(name))
}

type FileStorageFactory = {
    endpoint: string
    accessKeyId: string
    secretAccessKey: string
    region: string
    bucket: string
    forcePathStyle: boolean
}

export interface FileStorageModuleOptions {
    name?: string
    useFactory: (...args: any[]) => Promise<FileStorageFactory> | FileStorageFactory
    inject?: any[]
}

@Module({})
export class FileStorageModule {
    static register(options: FileStorageModuleOptions): DynamicModule {
        const { name, useFactory, inject } = options

        const provider = {
            provide: FileStorageService.getServiceName(name),
            useFactory: async (...args: any[]) => {
                const { endpoint, accessKeyId, secretAccessKey, region, bucket, forcePathStyle } =
                    await useFactory(...args)

                const client = new S3Client({
                    endpoint,
                    region,
                    credentials: { accessKeyId, secretAccessKey },
                    forcePathStyle
                })
                return new FileStorageService(bucket, client)
            },
            inject
        }

        return { module: FileStorageModule, providers: [provider], exports: [provider] }
    }
}
