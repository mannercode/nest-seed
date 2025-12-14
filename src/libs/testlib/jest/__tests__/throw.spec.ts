describe('error handlings', () => {
    describe('Asynchronous function handling', () => {
        it('Return value', async () => {
            const returnValue = async () => 'ok'

            await expect(returnValue()).resolves.toEqual('ok')
        })

        it('Throw exception', async () => {
            const throwException = async () => {
                throw new Error('error')
            }

            await expect(throwException()).rejects.toThrow('error')
        })

        it('Catch exception', async () => {
            const throwException = async () => {
                throw new Error('error')
            }

            const promise = throwException()
            const error = await promise.catch((e) => e)

            expect(error).toBeInstanceOf(Error)
            expect(error.message).toBe('error')
        })
    })

    describe('Synchronous function handling', () => {
        it('Return value', () => {
            const returnValue = () => 'ok'

            expect(returnValue).not.toThrow()
        })

        it('Throw exception', () => {
            const throwException = () => {
                throw new Error('error')
            }

            expect(throwException).toThrow('error')
        })

        it('Catch exception', () => {
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
