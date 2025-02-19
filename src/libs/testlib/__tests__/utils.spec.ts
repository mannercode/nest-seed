import { Path } from 'common'
import fs from 'fs/promises'
import path from 'path'
import { createDummyFile, EnvVars } from '..'

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

    it('should create a file with the specified size', async () => {
        const sizeInBytes = 5 * 1024 * 1024 // 5 MB
        await createDummyFile(testFilePath, sizeInBytes)
        const stats = await fs.stat(testFilePath)
        expect(stats.size).toBe(sizeInBytes)
    })

    it('should create a file with repeating content', async () => {
        const sizeInBytes = 100
        await createDummyFile(testFilePath, sizeInBytes)
        const content = await fs.readFile(testFilePath, 'utf-8')
        expect(content).toMatch(/^[A-Z가-하~!@#$%^&*()_+]+$/)
    })
})

describe('EnvVars', () => {
    describe('getString', () => {
        beforeEach(() => {
            delete process.env.TEST_STRING
        })

        it('환경변수가 존재할 때 해당 값을 반환해야 한다', () => {
            process.env.TEST_STRING = 'hello'
            expect(EnvVars.getString('TEST_STRING')).toBe('hello')
        })

        it('환경변수가 없으면 에러를 던져야 한다', () => {
            expect(() => EnvVars.getString('TEST_STRING')).toThrow(
                'Environment variable TEST_STRING is not defined'
            )
        })
    })

    describe('getNumber', () => {
        beforeEach(() => {
            delete process.env.TEST_NUMBER
        })

        it('숫자 문자열이 주어지면 숫자로 변환하여 반환해야 한다', () => {
            process.env.TEST_NUMBER = '123'
            expect(EnvVars.getNumber('TEST_NUMBER')).toBe(123)
        })

        it('숫자 문자열이 아닌 경우 에러를 던져야 한다', () => {
            process.env.TEST_NUMBER = 'abc'
            expect(() => EnvVars.getNumber('TEST_NUMBER')).toThrow(
                'Environment variable TEST_NUMBER must be a valid number'
            )
        })

        it('환경변수가 없으면 에러를 던져야 한다', () => {
            expect(() => EnvVars.getNumber('TEST_NUMBER')).toThrow(
                'Environment variable TEST_NUMBER is not defined'
            )
        })
    })
})
