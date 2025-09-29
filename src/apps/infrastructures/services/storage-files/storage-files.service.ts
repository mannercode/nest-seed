import { Injectable } from '@nestjs/common'
import { FileUtil, mapDocToDto, Path, S3ObjectService } from 'common'
import { HydratedDocument } from 'mongoose'
import { AppConfigService } from 'shared'
import { CreateStorageFileDto, StorageFileDto } from './dtos'
import { StorageFile, StorageFileDocument } from './models'
import { StorageFilesRepository } from './storage-files.repository'

@Injectable()
export class StorageFilesService {
    constructor(
        private repository: StorageFilesRepository,
        private config: AppConfigService,
        private s3Service: S3ObjectService
    ) {}

    async saveFiles(createDtos: CreateStorageFileDto[]) {
        const checksumByPath = new Map<string, string>()

        for (const createDto of createDtos) {
            const checksum = await FileUtil.getChecksum(createDto.path)
            checksumByPath.set(createDto.path, checksum)
        }

        const storageFiles = await this.repository.withTransaction(async (session) => {
            const storageFiles: HydratedDocument<StorageFile>[] = []

            for (const createDto of createDtos) {
                const storageFile = await this.repository.createStorageFile(
                    createDto,
                    checksumByPath.get(createDto.path)!,
                    session
                )

                // The file systems of the source and storage location are different, so the move operation cannot be performed.
                // 원본과 저장 위치의 파일 시스템이 달라서 move를 할 수 없다.
                await Path.copy(createDto.path, this.getStoragePath(storageFile.id))

                storageFiles.push(storageFile)
            }

            return storageFiles
        })

        return this.toDtos(storageFiles)
    }

    async getFiles(fileIds: string[]) {
        const files = await this.repository.getByIds(fileIds)
        return this.toDtos(files)
    }

    async deleteFiles(fileIds: string[]) {
        const deletedFiles = await this.repository.deleteByIds(fileIds)

        for (const fileId of fileIds) {
            const targetPath = this.getStoragePath(fileId)
            await Path.delete(targetPath)
        }

        return { deletedStorageFiles: this.toDtos(deletedFiles) }
    }

    private getStoragePath(fileId: string) {
        const path = Path.join(this.config.fileUpload.directory, `${fileId}.file`)
        return path
    }

    private toDto = (file: StorageFileDocument) => {
        const dto = mapDocToDto(file, StorageFileDto, [
            'id',
            'originalName',
            'mimeType',
            'size',
            'checksum'
        ])
        dto.storedPath = this.getStoragePath(file.id)

        return dto
    }
    private toDtos = (files: StorageFileDocument[]) => files.map((file) => this.toDto(file))
}
