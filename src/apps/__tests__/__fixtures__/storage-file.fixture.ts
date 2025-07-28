import { CommonFixture } from '../__helpers__'

export const getStorageFiles = async (fix: CommonFixture, fileIds: string[]) => {
    return fix.storageFilesService.getFiles(fileIds)
}
