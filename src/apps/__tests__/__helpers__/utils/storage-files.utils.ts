import { CommonFixture } from '../create-common-fixture'

export const getStorageFiles = async (fix: CommonFixture, fileIds: string[]) => {
    return fix.storageFilesService.getFiles(fileIds)
}
