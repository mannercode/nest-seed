// Environment.test.ts
import { Environment } from 'common'

describe('Environment', () => {
    describe('getString 메서드', () => {
        beforeEach(() => {
            // 각 테스트마다 환경변수 초기화
            delete process.env.TEST_STRING
        })

        it('환경변수가 존재할 때 해당 값을 반환해야 한다', () => {
            process.env.TEST_STRING = 'hello'
            expect(Environment.getString('TEST_STRING')).toBe('hello')
        })

        it('환경변수가 없으면 에러를 던져야 한다', () => {
            expect(() => Environment.getString('TEST_STRING')).toThrowError(
                'Environment variable TEST_STRING is not defined'
            )
        })
    })

    describe('getNumber 메서드', () => {
        beforeEach(() => {
            delete process.env.TEST_NUMBER
        })

        it('숫자 문자열이 주어지면 숫자로 변환하여 반환해야 한다', () => {
            process.env.TEST_NUMBER = '123'
            expect(Environment.getNumber('TEST_NUMBER')).toBe(123)
        })

        it('숫자 문자열이 아닌 경우 에러를 던져야 한다', () => {
            process.env.TEST_NUMBER = 'abc'
            expect(() => Environment.getNumber('TEST_NUMBER')).toThrowError(
                'Environment variable TEST_NUMBER must be a valid number'
            )
        })

        it('환경변수가 없으면 에러를 던져야 한다', () => {
            expect(() => Environment.getNumber('TEST_NUMBER')).toThrowError(
                'Environment variable TEST_NUMBER is not defined'
            )
        })
    })
})
