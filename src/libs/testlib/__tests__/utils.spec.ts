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

    // 크기가 지정된 경우
    describe('when the size is specified', () => {
        // 해당 크기의 파일을 생성한다
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

        // 환경변수가 존재하는 경우
        describe('when the env var exists', () => {
            // 해당 값을 반환한다
            it('returns the value', () => {
                process.env.TEST_STRING = 'hello'
                expect(Env.getString('TEST_STRING')).toBe('hello')
            })
        })

        // 환경변수가 존재하지 않는 경우
        describe('when the env var is missing', () => {
            // 에러를 던진다
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

        // 숫자 문자열이 제공된 경우
        describe('when the value is numeric', () => {
            // 숫자로 변환하여 반환한다
            it('returns the converted number', () => {
                process.env.TEST_NUMBER = '123'
                expect(Env.getNumber('TEST_NUMBER')).toBe(123)
            })
        })

        // 숫자 문자열이 아닌 경우
        describe('when the value is not numeric', () => {
            // 에러를 던진다
            it('throws an error', () => {
                process.env.TEST_NUMBER = 'abc'
                expect(() => Env.getNumber('TEST_NUMBER')).toThrow(
                    'Environment variable TEST_NUMBER must be a valid number'
                )
            })
        })

        // 환경변수가 존재하지 않는 경우
        describe('when the env var is missing', () => {
            // 에러를 던진다
            it('throws an error', () => {
                expect(() => Env.getNumber('TEST_NUMBER')).toThrow(
                    'Environment variable TEST_NUMBER is not defined'
                )
            })
        })
    })
})
