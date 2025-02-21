import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import { ClientProxyConfig, Subjects } from 'shared/config'
import { StorageFileCreateDto, StorageFileDto } from './dtos'

@Injectable()
export class StorageFilesProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    @MethodLog({ level: 'verbose' })
    saveFiles(createDtos: StorageFileCreateDto[]): Promise<StorageFileDto[]> {
        return getProxyValue(this.service.send(Subjects.StorageFiles.saveFiles, createDtos))
    }

    @MethodLog({ level: 'verbose' })
    getStorageFile(fileId: string): Promise<StorageFileDto> {
        return getProxyValue(this.service.send(Subjects.StorageFiles.getStorageFile, fileId))
    }

    @MethodLog({ level: 'verbose' })
    deleteStorageFile(fileId: string): Promise<boolean> {
        return getProxyValue(this.service.send(Subjects.StorageFiles.deleteStorageFile, fileId))
    }
}
