import { CommonFixture } from '../create-common-fixture'
import { FixtureFile } from '../fixture-files'

export const getStorageFiles = async (fix: CommonFixture, fileIds: string[]) => {
    return fix.storageFilesService.getFiles(fileIds)
}

export const uploadStorageFiles = async (fixture: CommonFixture, files: FixtureFile[]) => {
    const uploadedFiles = await fixture.storageFilesService.saveFiles(files)
    return uploadedFiles
}
