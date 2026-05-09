describe('error handling', () => {
    describe('async functions', () => {
        it('값으로 resolve된다', async () => {
            const returnValue = async () => 'ok'

            await expect(returnValue()).resolves.toEqual('ok')
        })

        it('오류로 reject된다', async () => {
            const throwException = async () => {
                throw new Error('error')
            }

            await expect(throwException()).rejects.toThrow('error')
        })

        it('reject된 오류를 잡는다', async () => {
            const throwException = async () => {
                throw new Error('error')
            }

            const promise = throwException()
            const error = await promise.catch((e: unknown) => e as Error)

            expect(error).toBeInstanceOf(Error)
            expect(error.message).toBe('error')
        })
    })

    describe('sync functions', () => {
        it('예외를 던지지 않는다', () => {
            const returnValue = () => 'ok'

            expect(returnValue).not.toThrow()
        })

        it('오류를 던진다', () => {
            const throwException = () => {
                throw new Error('error')
            }

            expect(throwException).toThrow('error')
        })

        it('던져진 오류를 잡는다', () => {
            const throwException = () => {
                throw new Error('error')
            }

            try {
                throwException()
            } catch (error: unknown) {
                expect(error).toBeInstanceOf(Error)
                expect((error as Error).message).toBe('error')
            }
        })
    })
})
