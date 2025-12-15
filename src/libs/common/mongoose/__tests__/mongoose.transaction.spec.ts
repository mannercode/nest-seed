import type { MongooseTransactionFixture } from './mongoose.transaction.fixture'

describe('MongooseRepository.withTransaction', () => {
    let fix: MongooseTransactionFixture

    beforeEach(async () => {
        const { createMongooseTransactionFixture } = await import('./mongoose.transaction.fixture')
        fix = await createMongooseTransactionFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('withTransaction', () => {
        it('commits the transaction', async () => {
            const newDoc = await fix.repository.withTransaction(async (session) => {
                const doc = fix.repository.newDocument()
                doc.name = 'name'
                return doc.save({ session })
            })

            const found = await fix.repository.findById(newDoc.id)
            expect(found?.toJSON()).toEqual(newDoc.toJSON())
        })

        it('rolls back the transaction when rollback is requested', async () => {
            const newDoc = fix.repository.newDocument()
            newDoc.name = 'name'
            await newDoc.save()

            await fix.repository.withTransaction(async (session, rollback) => {
                await fix.repository.deleteById(newDoc.id, session)
                rollback()
            })

            const found = await fix.repository.findById(newDoc.id)
            expect(found?.toJSON()).toEqual(newDoc.toJSON())
        })

        it('rolls back changes when an error occurs during the transaction', async () => {
            const promise = fix.repository.withTransaction(async (session) => {
                const doc = fix.repository.newDocument()
                doc.name = 'name'
                await doc.save({ session })

                throw new Error('An error occurred during the transaction.')
            })

            await expect(promise).rejects.toThrow()

            const { total } = await fix.repository.findWithPagination({ pagination: {} })
            expect(total).toEqual(0)
        })
    })

    it('throws when startSession throws', async () => {
        jest.spyOn(fix.model, 'startSession').mockImplementation(() => {
            throw new Error()
        })

        const promise = fix.repository.withTransaction(async (_session) => {})

        await expect(promise).rejects.toThrow()
    })

    it('throws when startTransaction throws', async () => {
        jest.spyOn(fix.model, 'startSession').mockResolvedValue({
            startTransaction: jest.fn().mockImplementation(() => {
                throw new Error()
            }),
            inTransaction: jest.fn().mockReturnValue(false)
        } as any)

        const promise = fix.repository.withTransaction(async (_session) => {})

        await expect(promise).rejects.toThrow()
    })
})
