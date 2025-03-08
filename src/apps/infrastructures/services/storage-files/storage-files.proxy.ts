import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy, MethodLog } from 'common'
import { ClientProxyConfig, Messages } from 'shared/config'
import { StorageFileCreateDto, StorageFileDto } from './dtos'

@Injectable()
export class StorageFilesProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    @MethodLog({ level: 'verbose' })
    saveFiles(createDtos: StorageFileCreateDto[]): Promise<StorageFileDto[]> {
        return this.service.getJson(Messages.StorageFiles.saveFiles, createDtos)
    }

    @MethodLog({ level: 'verbose' })
    getStorageFile(fileId: string): Promise<StorageFileDto> {
        return this.service.getJson(Messages.StorageFiles.getStorageFile, fileId)
    }

    @MethodLog({ level: 'verbose' })
    deleteStorageFile(fileId: string): Promise<boolean> {
        return this.service.getJson(Messages.StorageFiles.deleteStorageFile, fileId)
    }
}
