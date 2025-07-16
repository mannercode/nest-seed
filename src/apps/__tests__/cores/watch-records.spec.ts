import { WatchRecordDto } from 'apps/cores'
import { expectEqualUnsorted, testObjectId } from 'testlib'
import { buildCreateWatchRecordDto, createWatchRecord } from '../common.fixture'
import { Fixture } from './watch-records.fixture'

describe('WatchRecords', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./watch-records.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('createWatchRecord', () => {
        // 관람 기록을 생성해야 한다
        it('Should create a watch record', async () => {
            const { createDto, expectedDto } = buildCreateWatchRecordDto()

            const watchRecord = await fix.watchRecordsClient.createWatchRecord(createDto)
            expect(watchRecord).toEqual(expectedDto)
        })
    })

    describe('searchWatchRecordsPage', () => {
        let records: WatchRecordDto[]
        const customerId = testObjectId(0xa1)

        beforeEach(async () => {
            records = await Promise.all([
                createWatchRecord(fix, { customerId }),
                createWatchRecord(fix, { customerId }),
                createWatchRecord(fix, { customerId }),
                createWatchRecord(fix, { customerId })
            ])
        })

        // 기본 페이지네이션으로 관람 기록 목록을 반환해야 한다
        it('Should return watch records with default pagination', async () => {
            const { items, ...paginated } = await fix.watchRecordsClient.searchWatchRecordsPage({
                customerId
            })

            expect(paginated).toEqual({
                skip: 0,
                take: expect.any(Number),
                total: records.length
            })
            expectEqualUnsorted(items, records)
        })
    })
})
