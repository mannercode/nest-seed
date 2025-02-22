describe('error handlings', () => {
    describe('asynchronous function handling', () => {
        it('return value', async () => {
            const returnValue = async () => 'ok'

            await expect(returnValue()).resolves.toEqual('ok')
        })

        it('throw exception', async () => {
            const throwException = async () => {
                throw new Error('error')
            }

            await expect(throwException()).rejects.toThrow('error')
        })
    })

    describe('synchronous function handling', () => {
        it('return value', () => {
            const returnValue = () => 'ok'

            expect(returnValue).not.toThrow()
        })

        it('throw exception', () => {
            const throwException = () => {
                throw new Error('error')
            }

            expect(throwException).toThrow('error')
        })
    })
})
