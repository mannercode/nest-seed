describe('error handlings', () => {
    describe('asynchronous error handling', () => {
        const throwException = async () => {
            throw new Error('error')
        }

        const notThrow = async () => 'ok'

        it('notThrow', async () => {
            const promise = notThrow()
            await expect(promise).resolves.toEqual('ok')
        })

        it('throwException', async () => {
            const promise = throwException()
            await expect(promise).rejects.toThrow('error')
        })
    })

    describe('synchronous error handling', () => {
        const throwException = () => {
            throw new Error('error')
        }

        const notThrow = () => 'ok'

        it('notThrow', () => {
            const callback = () => notThrow()
            expect(callback).not.toThrow()
        })

        it('throwException', () => {
            const callback = () => throwException()
            expect(callback).toThrow('error')
        })
    })
})
