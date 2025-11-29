import type { Fixture } from './mongoose.transaction.fixture'

describe('MongooseRepository.withTransaction', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./mongoose.transaction.fixture')
        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('withTransaction', () => {
        describe('when the transaction succeeds', () => {
            it('commits the transaction', async () => {
                const newDoc = await fixture.repository.withTransaction(async (session) => {
                    const doc = fixture.repository.newDocument()
                    doc.name = 'name'
                    return doc.save({ session })
                })

                const found = await fixture.repository.findById(newDoc.id)
                expect(found?.toJSON()).toEqual(newDoc.toJSON())
            })
        })

        describe('when a rollback is requested', () => {
            it('rolls back the transaction', async () => {
                const newDoc = fixture.repository.newDocument()
                newDoc.name = 'name'
                await newDoc.save()

                await fixture.repository.withTransaction(async (session, rollback) => {
                    await fixture.repository.deleteById(newDoc.id, session)
                    rollback()
                })

                const found = await fixture.repository.findById(newDoc.id)
                expect(found?.toJSON()).toEqual(newDoc.toJSON())
            })
        })

        describe('when an error occurs during the transaction', () => {
            it('rolls back changes', async () => {
                const promise = fixture.repository.withTransaction(async (session) => {
                    const doc = fixture.repository.newDocument()
                    doc.name = 'name'
                    await doc.save({ session })

                    throw new Error('An error occurred during the transaction.')
                })

                await expect(promise).rejects.toThrow()

                const { total } = await fixture.repository.findWithPagination({ pagination: {} })
                expect(total).toEqual(0)
            })
        })
    })

    it('dummy test for coverage', async () => {
        jest.spyOn(fixture.model, 'startSession').mockImplementation(() => {
            throw new Error()
        })

        const promise = fixture.repository.withTransaction(async (_session) => {})

        await expect(promise).rejects.toThrow()
    })

    it('dummy test for coverage', async () => {
        jest.spyOn(fixture.model, 'startSession').mockResolvedValue({
            startTransaction: jest.fn().mockImplementation(() => {
                throw new Error()
            }),
            inTransaction: jest.fn().mockReturnValue(false)
        } as any)

        const promise = fixture.repository.withTransaction(async (_session) => {})

        await expect(promise).rejects.toThrow()
    })
})
