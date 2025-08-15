import {
    CreateBucketCommand,
    CreateBucketCommandOutput,
    DeleteBucketCommand,
    DeleteBucketCommandOutput,
    DeleteObjectCommand,
    DeleteObjectCommandOutput,
    GetObjectCommand,
    GetObjectCommandOutput,
    ListBucketsCommand,
    ListBucketsCommandOutput,
    ListObjectsV2Command,
    ListObjectsV2CommandOutput,
    PutObjectCommand,
    PutObjectCommandInput,
    PutObjectCommandOutput,
    S3Client
} from '@aws-sdk/client-s3'
import { DynamicModule, Inject, Injectable, Module } from '@nestjs/common'

export type PutObjectInput = {
    bucket: string
    key: string
    body: Uint8Array | Buffer | string | ReadableStream<any> | NodeJS.ReadableStream
    contentType?: string
    cacheControl?: string
    contentDisposition?: string
    contentEncoding?: string
    metadata?: Record<string, string>
}

export type GetObjectInput = {
    bucket: string
    key: string
    /** HTTP Range 헤더 형태: e.g. 'bytes=0-99' */
    range?: string
    /** If-Match / If-None-Match / If-Modified-Since / If-Unmodified-Since 등 필요시 확장 */
}

export type DeleteObjectInput = { bucket: string; key: string }

export type ListObjectsInput = {
    bucket: string
    prefix?: string
    delimiter?: string
    continuationToken?: string
    maxKeys?: number
}

@Injectable()
export class AmazonS3Service {
    constructor(private readonly s3: S3Client) {}

    static getServiceName(name?: string) {
        return `AmazonS3Service_${name}`
    }

    /** 버킷 생성 */
    async createBucket(name: string): Promise<CreateBucketCommandOutput> {
        const command = new CreateBucketCommand({ Bucket: name })
        return await this.s3.send(command)
    }

    /** 모든 버킷 목록 조회 */
    async listBuckets(): Promise<ListBucketsCommandOutput> {
        const command = new ListBucketsCommand({})
        return await this.s3.send(command)
    }

    /** 버킷 삭제 (비어있지 않으면 BucketNotEmpty 예외) */
    async deleteBucket(name: string): Promise<DeleteBucketCommandOutput> {
        const command = new DeleteBucketCommand({ Bucket: name })
        return await this.s3.send(command)
    }

    /** 객체 업로드 */
    async putObject(input: PutObjectInput): Promise<PutObjectCommandOutput> {
        const params: PutObjectCommandInput = {
            Bucket: input.bucket,
            Key: input.key,
            Body: input.body as any,
            ContentType: input.contentType,
            CacheControl: input.cacheControl,
            ContentDisposition: input.contentDisposition,
            ContentEncoding: input.contentEncoding,
            Metadata: input.metadata
        }
        const command = new PutObjectCommand(params)
        return await this.s3.send(command)
    }

    /** 객체 조회 (Body는 스트림/버퍼/Uint8Array 등 런타임에 따라 다름) */
    async getObject(input: GetObjectInput): Promise<GetObjectCommandOutput> {
        const command = new GetObjectCommand({
            Bucket: input.bucket,
            Key: input.key,
            Range: input.range
        })
        return await this.s3.send(command)
    }

    /** 객체 삭제 (존재하지 않는 키 삭제도 204로 성공 처리되는 것이 일반적) */
    async deleteObject(input: DeleteObjectInput): Promise<DeleteObjectCommandOutput> {
        const command = new DeleteObjectCommand({ Bucket: input.bucket, Key: input.key })
        return await this.s3.send(command)
    }

    /** 객체 목록 조회 (ListObjectsV2) */
    async listObjects(input: ListObjectsInput): Promise<ListObjectsV2CommandOutput> {
        const command = new ListObjectsV2Command({
            Bucket: input.bucket,
            Prefix: input.prefix,
            Delimiter: input.delimiter,
            ContinuationToken: input.continuationToken,
            MaxKeys: input.maxKeys
        })
        return await this.s3.send(command)
    }

    // --- 선택적 편의 메서드 (원하시면 테스트에 맞춰 사용) ---

    // /** 버킷 존재 여부 확인(headBucket) */
    // async headBucket(name: string): Promise<void> {
    //     const cmd = new HeadBucketCommand({ Bucket: name })
    //     await this.s3.send(cmd)
    // }

    // /** 객체 메타데이터 확인(headObject) */
    // async headObject(bucket: string, key: string): Promise<void> {
    //     const cmd = new HeadObjectCommand({ Bucket: bucket, Key: key })
    //     await this.s3.send(cmd)
    // }
}

export function InjectAmazonS3(name?: string): ParameterDecorator {
    return Inject(AmazonS3Service.getServiceName(name))
}

export interface AmazonS3ModuleOptions {
    name?: string
    endpoint: string
    accessKeyId: string
    secretAccessKey: string
    region: string
    forcePathStyle: boolean
}

@Module({})
export class AmazonS3Module {
    static register(options: AmazonS3ModuleOptions): DynamicModule {
        const { name, endpoint, accessKeyId, secretAccessKey, region, forcePathStyle } = options

        const provider = {
            provide: AmazonS3Service.getServiceName(name),
            useFactory: async () => {
                const client = new S3Client({
                    endpoint,
                    region,
                    credentials: { accessKeyId, secretAccessKey },
                    forcePathStyle
                })
                return new AmazonS3Service(client)
            },
            inject: []
        }

        return { module: AmazonS3Module, providers: [provider], exports: [provider] }
    }
}
