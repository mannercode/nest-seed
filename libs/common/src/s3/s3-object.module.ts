import { S3Client } from '@aws-sdk/client-s3'
import { DynamicModule, Inject, Module } from '@nestjs/common'
import { S3ObjectService } from './s3-object.service'
import { S3ObjectModuleOptions } from './s3-object.types'

export function InjectS3Object(name?: string): ParameterDecorator {
    return Inject(S3ObjectService.getName(name))
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
