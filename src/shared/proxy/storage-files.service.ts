import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import { StorageFileCreateDto, StorageFileDto } from 'types'

@Injectable()
export class StorageFilesService {
    constructor(@InjectClientProxy('SERVICES_CLIENT') private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    saveFiles(createDtos: StorageFileCreateDto[]): Promise<StorageFileDto[]> {
        return getProxyValue(this.service.send('saveFiles', createDtos))
    }

    @MethodLog({ level: 'verbose' })
    getStorageFile(fileId: string): Promise<StorageFileDto> {
        return getProxyValue(this.service.send('getStorageFile', fileId))
    }

    @MethodLog({ level: 'verbose' })
    deleteStorageFile(fileId: string): Promise<boolean> {
        return getProxyValue(this.service.send('deleteStorageFile', fileId))
    }
}
