import type { MongooseTransactionFixture } from './mongoose-transaction.fixture'

describe('Mongoose Transaction', () => {
    let fix: MongooseTransactionFixture

    beforeEach(async () => {
        const { createMongooseTransactionFixture } = await import('./mongoose-transaction.fixture')
        fix = await createMongooseTransactionFixture()
    })
    afterEach(() => fix.teardown())

    describe('withTransaction', () => {
        // 트랜잭션이 성공할 때
        describe('when the transaction succeeds', () => {
            // 트랜잭션을 커밋한다
            it('commits the transaction', async () => {
                const newDoc = await fix.repository.withTransaction(async (session) => {
                    const doc = fix.repository.newDocument()
                    doc.name = 'name'
                    return doc.save({ session })
                })

                const found = await fix.repository.findById(newDoc.id)
                expect(found).toMatchObject({ id: newDoc.id, name: newDoc.name })
            })
        })

        // 롤백이 요청될 때
        describe('when rollback is requested', () => {
            let newDoc: any

            beforeEach(async () => {
                newDoc = fix.repository.newDocument()
                newDoc.name = 'name'
                await newDoc.save()
            })

            // 트랜잭션을 롤백한다
            it('rolls back the transaction', async () => {
                await fix.repository.withTransaction(async (session, rollback) => {
                    await fix.repository.deleteById(newDoc.id, session)
                    rollback()
                })

                const found = await fix.repository.findById(newDoc.id)
                expect(found).toMatchObject({ id: newDoc.id, name: newDoc.name })
            })
        })

        // 트랜잭션 중 오류가 발생할 때
        describe('when an error occurs during the transaction', () => {
            // 변경 사항을 롤백한다
            it('rolls back changes', async () => {
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
    })

    // startSession이 예외를 던질 때
    describe('when startSession throws', () => {
        beforeEach(() => {
            jest.spyOn(fix.model, 'startSession').mockImplementation(() => {
                throw new Error()
            })
        })

        // 예외를 던진다
        it('throws', async () => {
            const promise = fix.repository.withTransaction(async (_session) => {})

            await expect(promise).rejects.toThrow()
        })
    })

    // startTransaction이 예외를 던질 때
    describe('when startTransaction throws', () => {
        beforeEach(() => {
            jest.spyOn(fix.model, 'startSession').mockResolvedValue({
                inTransaction: jest.fn().mockReturnValue(false),
                startTransaction: jest.fn().mockImplementation(() => {
                    throw new Error()
                })
            } as any)
        })

        // 예외를 던진다
        it('throws', async () => {
            const promise = fix.repository.withTransaction(async (_session) => {})

            await expect(promise).rejects.toThrow()
        })
    })
})
