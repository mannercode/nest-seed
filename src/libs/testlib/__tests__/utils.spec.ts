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

    // 지정된 크기의 파일을 생성해야 한다
    it('Should create a file of the specified size', async () => {
        const sizeInBytes = Byte.fromString('500KB')
        await createDummyFile(testFilePath, sizeInBytes)
        const stats = await fs.stat(testFilePath)
        expect(stats.size).toBe(sizeInBytes)
    })
})

describe('Env', () => {
    describe('getString', () => {
        beforeEach(() => {
            delete process.env.TEST_STRING
        })

        // 환경변수가 존재하면 해당 값을 반환해야 한다
        it('Should return the value if the environment variable exists', () => {
            process.env.TEST_STRING = 'hello'
            expect(Env.getString('TEST_STRING')).toBe('hello')
        })

        // 환경변수가 없으면 에러를 던져야 한다
        it('Should throw an error if the environment variable does not exist', () => {
            expect(() => Env.getString('TEST_STRING')).toThrow(
                'Environment variable TEST_STRING is not defined'
            )
        })
    })

    describe('getNumber', () => {
        beforeEach(() => {
            delete process.env.TEST_NUMBER
        })

        // 숫자 문자열이 주어지면 숫자로 변환하여 반환해야 한다
        it('Should convert and return the value if a numeric string is given', () => {
            process.env.TEST_NUMBER = '123'
            expect(Env.getNumber('TEST_NUMBER')).toBe(123)
        })

        // 숫자 문자열이 아닌 경우 에러를 던져야 한다
        it('Should throw an error if the value is not a numeric string', () => {
            process.env.TEST_NUMBER = 'abc'
            expect(() => Env.getNumber('TEST_NUMBER')).toThrow(
                'Environment variable TEST_NUMBER must be a valid number'
            )
        })

        // 환경변수가 없으면 에러를 던져야 한다
        it('Should throw an error if the environment variable does not exist', () => {
            expect(() => Env.getNumber('TEST_NUMBER')).toThrow(
                'Environment variable TEST_NUMBER is not defined'
            )
        })
    })
})
