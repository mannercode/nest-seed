import { Injectable } from '@nestjs/common'
import { DocumentId, getChecksum, MethodLog, Path } from 'common'
import { Config } from 'config'
import { StorageFileCreationDto, StorageFileDto } from './dto'
import { StorageFile } from './schemas'
import { StorageFilesRepository } from './storage-files.repository'

@Injectable()
export class StorageFilesService {
    constructor(private repository: StorageFilesRepository) {}

    @MethodLog()
    async saveFiles(creationDtos: StorageFileCreationDto[]) {
        const storageFiles = await this.repository.withTransaction(async (session) => {
            const storageFiles: StorageFile[] = []

            for (const creationDto of creationDtos) {
                const storageFile = await this.repository.createStorageFile(
                    { ...creationDto, checksum: await getChecksum(creationDto.uploadedFilePath) },
                    session
                )
                Path.copy(creationDto.uploadedFilePath, this.getStoragePath(storageFile.id))

                storageFiles.push(storageFile)
            }

            return storageFiles
        })

        return storageFiles.map((file) => this.makeStorageFileDto(file))
    }

    @MethodLog({ level: 'verbose' })
    async getStorageFile(fileId: string) {
        const file = await this.repository.getStorageFile(fileId)
        return this.makeStorageFileDto(file!)
    }

    @MethodLog()
    async deleteStorageFile(fileId: string) {
        await this.repository.deleteStorageFile(fileId)

        const targetPath = this.getStoragePath(fileId)
        await Path.delete(targetPath)

        return true
    }

    private makeStorageFileDto(file: StorageFile) {
        const dto = new StorageFileDto(file, this.getStoragePath(file.id))
        return dto
    }

    private getStoragePath(fileId: DocumentId) {
        const path = Path.join(Config.fileUpload.directory, `${fileId}.file`)
        return path
    }
}
