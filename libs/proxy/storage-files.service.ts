import { Injectable } from '@nestjs/common'
import { ClientProxyService, MethodLog } from 'common'
import { Observable } from 'rxjs'
import { StorageFileCreateDto, StorageFileDto } from 'types'

@Injectable()
export class StorageFilesService {
    constructor(private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    saveFiles(createDtos: StorageFileCreateDto[]): Observable<StorageFileDto[]> {
        return this.service.send('saveFiles', createDtos)
    }

    @MethodLog({ level: 'verbose' })
    getStorageFile(fileId: string): Observable<StorageFileDto> {
        return this.service.send('getStorageFile', fileId)
    }

    @MethodLog({ level: 'verbose' })
    deleteStorageFile(fileId: string): Observable<boolean> {
        return this.service.send('deleteStorageFile', fileId)
    }
}
