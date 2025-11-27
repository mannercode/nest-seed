import { Injectable } from '@nestjs/common'
import { FileUtil, InjectS3Object, mapDocToDto, Path, S3ObjectService } from 'common'
import { readFile } from 'fs/promises'
import { HydratedDocument } from 'mongoose'
import { AppConfigService } from 'shared'
import {
    AttachmentDto,
    CompleteAttachmentDto,
    CreateAttachmentDto,
    PresignDownloadUrlDto,
    PresignDownloadUrlResponse,
    PresignUploadUrlDto,
    PresignUploadUrlResponse
} from './dtos'
import { Attachment, AttachmentDocument } from './models'
import { AttachmentsRepository } from './attachments.repository'

const DEFAULT_PRESIGN_EXPIRES_SEC = 60

@Injectable()
export class AttachmentsService {
    constructor(
        private repository: AttachmentsRepository,
        private config: AppConfigService,
        @InjectS3Object() private s3Service: S3ObjectService
    ) {}

    async saveFiles(createDtos: CreateAttachmentDto[]) {
        const checksumByPath = new Map<string, string>()

        for (const createDto of createDtos) {
            const checksum = await FileUtil.getChecksum(createDto.path)
            checksumByPath.set(createDto.path, checksum)
        }

        const attachments = await this.repository.withTransaction(async (session) => {
            const docs: HydratedDocument<Attachment>[] = []

            for (const createDto of createDtos) {
                const attachment = await this.repository.createAttachment(
                    createDto,
                    checksumByPath.get(createDto.path)!,
                    session
                )

                // The file systems of the source and storage location are different, so the move operation cannot be performed.
                // 원본과 저장 위치의 파일 시스템이 달라서 move를 할 수 없다.
                await Path.copy(createDto.path, this.getAttachmentPath(attachment.id))

                await this.uploadToS3(attachment, this.getAttachmentPath(attachment.id))

                docs.push(attachment)
            }

            return docs
        })

        return this.toDtos(attachments)
    }

    async getFiles(fileIds: string[]) {
        const files = await this.repository.getByIds(fileIds)
        return this.toDtos(files)
    }

    async presignUploadUrl(dto: PresignUploadUrlDto): Promise<PresignUploadUrlResponse> {
        const expiresInSec = dto.expiresInSec ?? DEFAULT_PRESIGN_EXPIRES_SEC

        return this.repository.withTransaction(async (session) => {
            const attachment = await this.repository.createAttachment(
                { originalName: dto.originalName, mimeType: dto.mimeType, size: dto.size },
                dto.checksum,
                session
            )

            const attachmentId = attachment.id
            const uploadUrl = await this.s3Service.presignUploadUrl({
                key: attachmentId,
                expiresInSec,
                contentType: dto.mimeType,
                contentLength: dto.size
            })

            return {
                attachmentId,
                uploadUrl,
                expiresAt: this.getExpiresAt(expiresInSec),
                method: 'PUT' as const,
                headers: { 'Content-Type': dto.mimeType, 'Content-Length': dto.size.toString() },
                attachment: this.toDto(attachment)
            }
        })
    }

    async presignDownloadUrl(dto: PresignDownloadUrlDto): Promise<PresignDownloadUrlResponse> {
        const expiresInSec = dto.expiresInSec ?? DEFAULT_PRESIGN_EXPIRES_SEC
        const attachment = await this.repository.getById(dto.attachmentId)

        const downloadUrl = await this.s3Service.presignDownloadUrl({
            key: attachment.id,
            expiresInSec
        })

        const dtoWithUrl = this.toDto(attachment)
        dtoWithUrl.downloadUrl = downloadUrl
        dtoWithUrl.downloadUrlExpiresAt = this.getExpiresAt(expiresInSec)

        return dtoWithUrl
    }

    async complete(dto: CompleteAttachmentDto) {
        const attachment = await this.repository.update(dto.attachmentId, {
            ownerService: dto.ownerService,
            ownerEntityId: dto.ownerEntityId
        })

        return this.toDto(attachment)
    }

    async deleteFiles(fileIds: string[]) {
        const deletedFiles = await this.repository.deleteByIds(fileIds)

        for (const fileId of fileIds) {
            const targetPath = this.getAttachmentPath(fileId)
            await Path.delete(targetPath)
        }

        return { deletedAttachments: this.toDtos(deletedFiles) }
    }

    private getAttachmentPath(fileId: string) {
        const path = Path.join(this.config.fileUpload.directory, `${fileId}.file`)
        return path
    }

    private async uploadToS3(attachment: AttachmentDocument, filePath: string) {
        const uploadUrl = await this.s3Service.presignUploadUrl({
            key: attachment.id,
            expiresInSec: DEFAULT_PRESIGN_EXPIRES_SEC,
            contentType: attachment.mimeType,
            contentLength: attachment.size
        })

        const data = await readFile(filePath)
        const res = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': attachment.mimeType,
                'Content-Length': attachment.size.toString()
            },
            body: data
        })

        if (!res.ok) {
            throw new Error(`Failed to upload file ${attachment.id} to S3`)
        }
    }

    private getExpiresAt(expiresInSec: number) {
        return new Date(Date.now() + expiresInSec * 1000)
    }

    private toDto = (file: AttachmentDocument): AttachmentDto => {
        const dto = mapDocToDto(file, AttachmentDto, [
            'id',
            'originalName',
            'mimeType',
            'size',
            'checksum',
            'ownerService',
            'ownerEntityId'
        ])
        dto.storedPath = this.getAttachmentPath(file.id)

        return dto
    }
    private toDtos = (files: AttachmentDocument[]) => files.map((file) => this.toDto(file))
}
