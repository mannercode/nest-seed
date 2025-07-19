import { WatchRecordDto } from 'apps/cores'
import { expectEqualUnsorted, testObjectId } from 'testlib'
import { buildCreateWatchRecordDto, createWatchRecord } from '../common.fixture'
import { Fixture } from './watch-records.fixture'

// 기능 단위: 관람 기록 서비스
describe('WatchRecordsService', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./watch-records.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('createWatchRecord()', () => {
        // 기대 결과: 새로운 관람 기록을 성공적으로 생성한다.
        it('creates new watch record successfully', async () => {
            const { createDto, expectedDto } = buildCreateWatchRecordDto()

            const watchRecord = await fix.watchRecordsClient.createWatchRecord(createDto)
            expect(watchRecord).toEqual(expectedDto)
        })
    })

    describe('searchWatchRecordsPage()', () => {
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

        // 상황: 다양한 조건으로 필터링할 때
        describe('when filtering with various criteria', () => {
            // 기대 결과: customer ID로 필터링된 티켓 목록을 반환한다.
            it('returns a paginated list of watch records filtered by customer ID', async () => {
                const { items, ...paginated } = await fix.watchRecordsClient.searchWatchRecordsPage(
                    {
                        customerId
                    }
                )

                expect(paginated).toEqual({
                    skip: 0,
                    take: expect.any(Number),
                    total: records.length
                })
                expectEqualUnsorted(items, records)
            })
        })
    })
})
