import { Byte, Path } from 'common'
import fs from 'fs/promises'
import path from 'path'
import { createDummyFile, Env } from 'testlib'

describe('createDummyFile', () => {
    let tempDir: string
    let testFilePath: string

    beforeEach(async () => {
        tempDir = await Path.createTempDirectory()
        testFilePath = path.join(tempDir, 'test-file.txt')
    })

    afterEach(async () => {
        await Path.delete(tempDir)
    })

    describe('when the size is specified', () => {
        it('creates a file of the given size', async () => {
            const sizeInBytes = Byte.fromString('500KB')
            await createDummyFile(testFilePath, sizeInBytes)
            const stats = await fs.stat(testFilePath)
            expect(stats.size).toBe(sizeInBytes)
        })
    })
})

describe('Env', () => {
    describe('getString', () => {
        beforeEach(() => {
            delete process.env.TEST_STRING
        })

        describe('when the env var exists', () => {
            it('returns the value', () => {
                process.env.TEST_STRING = 'hello'
                expect(Env.getString('TEST_STRING')).toBe('hello')
            })
        })

        describe('when the env var is missing', () => {
            it('throws an error', () => {
                expect(() => Env.getString('TEST_STRING')).toThrow(
                    'Environment variable TEST_STRING is not defined'
                )
            })
        })
    })

    describe('getNumber', () => {
        beforeEach(() => {
            delete process.env.TEST_NUMBER
        })

        describe('when the value is numeric', () => {
            it('returns the converted number', () => {
                process.env.TEST_NUMBER = '123'
                expect(Env.getNumber('TEST_NUMBER')).toBe(123)
            })
        })

        describe('when the value is not numeric', () => {
            it('throws an error', () => {
                process.env.TEST_NUMBER = 'abc'
                expect(() => Env.getNumber('TEST_NUMBER')).toThrow(
                    'Environment variable TEST_NUMBER must be a valid number'
                )
            })
        })

        describe('when the env var is missing', () => {
            it('throws an error', () => {
                expect(() => Env.getNumber('TEST_NUMBER')).toThrow(
                    'Environment variable TEST_NUMBER is not defined'
                )
            })
        })
    })
})
