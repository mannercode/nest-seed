import { Controller, ParseArrayPipe } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared/config'
import { StorageFileCreateDto } from './dtos'
import { StorageFilesService } from './storage-files.service'

@Controller()
export class StorageFilesController {
    constructor(private service: StorageFilesService) {}

    @MessagePattern(Messages.StorageFiles.saveFiles)
    saveFiles(
        @Payload(new ParseArrayPipe({ items: StorageFileCreateDto }))
        createDtos: StorageFileCreateDto[]
    ) {
        return this.service.saveFiles(createDtos)
    }

    @MessagePattern(Messages.StorageFiles.getStorageFile)
    getStorageFile(@Payload() fileId: string) {
        return this.service.getStorageFile(fileId)
    }

    @MessagePattern(Messages.StorageFiles.deleteStorageFile)
    deleteStorageFile(@Payload() fileId: string) {
        return this.service.deleteStorageFile(fileId)
    }
}
