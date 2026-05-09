describe('예외 처리', () => {
    describe('async 함수', () => {
        it('값으로 resolve된다', async () => {
            const returnValue = async () => 'ok'

            await expect(returnValue()).resolves.toEqual('ok')
        })

        it('예외로 reject된다', async () => {
            const throwException = async () => {
                throw new Error('error')
            }

            await expect(throwException()).rejects.toThrow('error')
        })

        it('reject된 예외를 잡는다', async () => {
            const throwException = async () => {
                throw new Error('error')
            }

            const promise = throwException()
            const error = await promise.catch((e: unknown) => e as Error)

            expect(error).toBeInstanceOf(Error)
            expect(error.message).toBe('error')
        })
    })

    describe('동기 함수', () => {
        it('예외를 던지지 않는다', () => {
            const returnValue = () => 'ok'

            expect(returnValue).not.toThrow()
        })

        it('예외를 던진다', () => {
            const throwException = () => {
                throw new Error('error')
            }

            expect(throwException).toThrow('error')
        })

        it('던져진 예외를 잡는다', () => {
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
