import { Controller, ParseArrayPipe } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { StorageFileCreateDto } from './dtos'
import { StorageFilesService } from './storage-files.service'

@Controller()
export class StorageFilesController {
    constructor(private service: StorageFilesService) {}

    @MessagePattern('nestSeed.infrastructures.storageFiles.saveFiles')
    saveFiles(
        @Payload(new ParseArrayPipe({ items: StorageFileCreateDto }))
        createDtos: StorageFileCreateDto[]
    ) {
        return this.service.saveFiles(createDtos)
    }

    @MessagePattern('nestSeed.infrastructures.storageFiles.getStorageFile')
    getStorageFile(@Payload() fileId: string) {
        return this.service.getStorageFile(fileId)
    }

    @MessagePattern('nestSeed.infrastructures.storageFiles.deleteStorageFile')
    deleteStorageFile(@Payload() fileId: string) {
        return this.service.deleteStorageFile(fileId)
    }
}
