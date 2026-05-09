import type { MongooseTransactionFixture } from './mongoose-transaction.fixture'

describe('Mongoose Transaction', () => {
    let fix: MongooseTransactionFixture

    beforeEach(async () => {
        const { createMongooseTransactionFixture } = await import('./mongoose-transaction.fixture')
        fix = await createMongooseTransactionFixture()
    })
    afterEach(() => fix.teardown())

    describe('withTransaction', () => {
        describe('트랜잭션이 성공할 때', () => {
            it('트랜잭션을 커밋한다', async () => {
                const newDoc = await fix.repository.withTransaction(async (session) => {
                    const doc = fix.repository.newDocument()
                    doc.name = 'name'
                    return doc.save({ session })
                })

                const found = await fix.repository.findById(newDoc.id)
                expect(found).toMatchObject({ id: newDoc.id, name: newDoc.name })
            })
        })

        describe('롤백이 요청될 때', () => {
            let newDoc: any

            beforeEach(async () => {
                newDoc = fix.repository.newDocument()
                newDoc.name = 'name'
                await newDoc.save()
            })

            it('트랜잭션을 롤백한다', async () => {
                await fix.repository.withTransaction(async (session, rollback) => {
                    await fix.repository.deleteById(newDoc.id, session)
                    rollback()
                })

                const found = await fix.repository.findById(newDoc.id)
                expect(found).toMatchObject({ id: newDoc.id, name: newDoc.name })
            })
        })

        describe('트랜잭션 중 오류가 발생할 때', () => {
            it('변경 사항을 롤백한다', async () => {
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

        it.todo('rollback() 호출 후에는 commitTransaction 이 아니라 abortTransaction 이 실행된다')
    })

    describe('에러 처리', () => {
        it('startSession이 예외를 던질 때 예외를 전파한다', async () => {
            jest.spyOn(fix.model, 'startSession').mockImplementation(() => {
                throw new Error()
            })

            const promise = fix.repository.withTransaction(async (_session) => {})

            await expect(promise).rejects.toThrow()
        })

        it('startTransaction이 예외를 던질 때 예외를 전파한다', async () => {
            jest.spyOn(fix.model, 'startSession').mockResolvedValue({
                inTransaction: jest.fn().mockReturnValue(false),
                startTransaction: jest.fn().mockImplementation(() => {
                    throw new Error()
                })
            } as any)

            const promise = fix.repository.withTransaction(async (_session) => {})

            await expect(promise).rejects.toThrow()
        })
    })
})
