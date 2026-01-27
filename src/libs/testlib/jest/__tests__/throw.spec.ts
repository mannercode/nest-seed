import { get } from 'lodash'

describe('error handling', () => {
    describe('async functions', () => {
        // 값으로 resolve된다
        it('resolves with a value', async () => {
            const returnValue = async () => 'ok'

            await expect(returnValue()).resolves.toEqual('ok')
        })

        // 오류로 reject된다
        it('rejects with an error', async () => {
            const throwException = async () => {
                throw new Error('error')
            }

            await expect(throwException()).rejects.toThrow('error')
        })

        // reject된 오류를 잡는다
        it('catches a rejected error', async () => {
            const throwException = async () => {
                throw new Error('error')
            }

            const promise = throwException()
            const error = await promise.catch((e) => e)

            expect(error).toBeInstanceOf(Error)
            expect(error.message).toBe('error')
        })
    })

    describe('sync functions', () => {
        // 예외를 던지지 않는다
        it('does not throw', () => {
            const returnValue = () => 'ok'

            expect(returnValue).not.toThrow()
        })

        // 오류를 던진다
        it('throws an error', () => {
            const throwException = () => {
                throw new Error('error')
            }

            expect(throwException).toThrow('error')
        })

        // 던져진 오류를 잡는다
        it('catches a thrown error', () => {
            const throwException = () => {
                throw new Error('error')
            }

            try {
                throwException()
            } catch (error: unknown) {
                const message = get(error, 'message', String(error))

                expect(error).toBeInstanceOf(Error)
                expect(message).toBe('error')
            }
        })
    })
})
