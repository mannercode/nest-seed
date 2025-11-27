import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'
import {
    CompleteStorageFileDto,
    CreateStorageFileDto,
    DeleteStorageFilesResponse,
    PresignDownloadUrlResponse,
    PresignUploadUrlDto,
    PresignUploadUrlResponse,
    StorageFileDto
} from './dtos'

@Injectable()
export class StorageFilesClient {
    constructor(@InjectClientProxy() private proxy: ClientProxyService) {}

    saveFiles(createDtos: CreateStorageFileDto[]): Promise<StorageFileDto[]> {
        return this.proxy.getJson(Messages.StorageFiles.saveFiles, createDtos)
    }

    getFiles(fileIds: string[]): Promise<StorageFileDto[]> {
        return this.proxy.getJson(Messages.StorageFiles.getFiles, fileIds)
    }

    deleteFiles(fileIds: string[]): Promise<DeleteStorageFilesResponse> {
        return this.proxy.getJson(Messages.StorageFiles.deleteFiles, fileIds)
    }

    presignUploadUrl(dto: PresignUploadUrlDto): Promise<PresignUploadUrlResponse> {
        return this.proxy.getJson(Messages.StorageFiles.presignUploadUrl, dto)
    }

    presignDownloadUrl(
        storageFileId: string,
        expiresInSec?: number
    ): Promise<PresignDownloadUrlResponse> {
        return this.proxy.getJson(Messages.StorageFiles.presignDownloadUrl, {
            storageFileId,
            expiresInSec
        })
    }

    complete(
        storageFileId: string,
        ownerInfo: Omit<CompleteStorageFileDto, 'storageFileId'>
    ): Promise<StorageFileDto> {
        return this.proxy.getJson(Messages.StorageFiles.complete, { storageFileId, ...ownerInfo })
    }
}
