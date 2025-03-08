import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { ClientProxyConfig, Messages } from 'shared/config'
import { StorageFileCreateDto, StorageFileDto } from './dtos'

@Injectable()
export class StorageFilesProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    saveFiles(createDtos: StorageFileCreateDto[]): Promise<StorageFileDto[]> {
        return this.service.getJson(Messages.StorageFiles.saveFiles, createDtos)
    }

    getStorageFile(fileId: string): Promise<StorageFileDto> {
        return this.service.getJson(Messages.StorageFiles.getStorageFile, fileId)
    }

    deleteStorageFile(fileId: string): Promise<boolean> {
        return this.service.getJson(Messages.StorageFiles.deleteStorageFile, fileId)
    }
}
