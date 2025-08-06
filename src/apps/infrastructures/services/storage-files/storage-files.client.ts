import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'
import { CreateStorageFileDto, DeleteStorageFilesResponse, StorageFileDto } from './dtos'

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
}
