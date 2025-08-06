import { TestContext } from 'testlib'
import { FixtureFile } from '../fixture-files'

export const getStorageFiles = async ({ module }: TestContext, fileIds: string[]) => {
    const { StorageFilesClient } = await import('apps/infrastructures')
    const storageFilesService = module.get(StorageFilesClient)

    return storageFilesService.getFiles(fileIds)
}

export const uploadStorageFiles = async ({ module }: TestContext, files: FixtureFile[]) => {
    const { StorageFilesClient } = await import('apps/infrastructures')
    const storageFilesService = module.get(StorageFilesClient)

    const uploadedFiles = await storageFilesService.saveFiles(files)
    return uploadedFiles
}
