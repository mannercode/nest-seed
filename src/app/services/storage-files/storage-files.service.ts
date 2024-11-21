import { Injectable } from '@nestjs/common'
import { getChecksum, MethodLog, objectId, ObjectId, Path, toDto } from 'common'
import { AppConfigService } from 'config'
import { StorageFileCreateDto, StorageFileDto } from './dtos'
import { StorageFile } from './models'
import { StorageFilesRepository } from './storage-files.repository'
import { HydratedDocument } from 'mongoose'

@Injectable()
export class StorageFilesService {
    constructor(
        private repository: StorageFilesRepository,
        private config: AppConfigService
    ) {}

    @MethodLog()
    async saveFiles(createDtos: StorageFileCreateDto[]) {
        const storageFiles = await this.repository.withTransaction(async (session) => {
            const storageFiles: HydratedDocument<StorageFile>[] = []

            for (const createDto of createDtos) {
                const storageFile = await this.repository.createStorageFile(
                    { ...createDto, checksum: await getChecksum(createDto.uploadedFilePath) },
                    session
                )
                Path.copy(createDto.uploadedFilePath, this.getStoragePath(storageFile.id))

                storageFiles.push(storageFile)
            }

            return storageFiles
        })

        return storageFiles.map((file) => this.createStorageFileDto(file))
    }

    @MethodLog({ level: 'verbose' })
    async getStorageFile(fileId: string) {
        const file = await this.repository.getStorageFile(objectId(fileId))
        return this.createStorageFileDto(file)
    }

    @MethodLog()
    async deleteStorageFile(fileId: string) {
        await this.repository.deleteStorageFile(objectId(fileId))

        const targetPath = this.getStoragePath(objectId(fileId))
        await Path.delete(targetPath)

        return true
    }

    private createStorageFileDto(file: HydratedDocument<StorageFile>) {
        const dto = toDto(file, StorageFileDto, this.getStoragePath(file.id))
        return dto
    }

    private getStoragePath(fileId: ObjectId) {
        const path = Path.join(this.config.fileUpload.directory, `${fileId}.file`)
        return path
    }
}
