describe('error handling', () => {
    describe('async functions', () => {
        it('resolves with a value', async () => {
            const returnValue = async () => 'ok'

            await expect(returnValue()).resolves.toEqual('ok')
        })

        it('rejects with an error', async () => {
            const throwException = async () => {
                throw new Error('error')
            }

            await expect(throwException()).rejects.toThrow('error')
        })

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
        it('does not throw', () => {
            const returnValue = () => 'ok'

            expect(returnValue).not.toThrow()
        })

        it('throws an error', () => {
            const throwException = () => {
                throw new Error('error')
            }

            expect(throwException).toThrow('error')
        })

        it('catches a thrown error', () => {
            const throwException = () => {
                throw new Error('error')
            }

            try {
                throwException()
            } catch (error) {
                expect(error).toBeInstanceOf(Error)
                expect(error.message).toBe('error')
            }
        })
    })
})
