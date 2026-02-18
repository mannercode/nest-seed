import type { SearchWatchRecordsPageDto, WatchRecordDto } from 'apps/cores'
import { buildCreateWatchRecordDto, createWatchRecord } from 'apps/__tests__/__helpers__'
import { oid } from 'testlib'
import type { WatchRecordsFixture } from './watch-records.fixture'

describe('WatchRecordsService', () => {
    let fix: WatchRecordsFixture

    beforeEach(async () => {
        const { createWatchRecordsFixture } = await import('./watch-records.fixture')
        fix = await createWatchRecordsFixture()
    })
    afterEach(() => fix.teardown())

    describe('create', () => {
        // 생성된 시청 기록을 반환한다
        it('returns the created watch record', async () => {
            const createDto = buildCreateWatchRecordDto()
            const watchRecord = await fix.watchRecordsClient.create(createDto)

            expect(watchRecord).toEqual({ ...createDto, id: expect.any(String) })
        })
    })

    describe('searchPage', () => {
        const customerId = oid(0xa1)
        let watchRecords: WatchRecordDto[]

        beforeEach(async () => {
            watchRecords = await Promise.all([
                createWatchRecord(fix, { customerId }),
                createWatchRecord(fix, { customerId }),
                createWatchRecord(fix, {}),
                createWatchRecord(fix, {})
            ])
        })

        const buildExpectedPage = (expectedRecords: WatchRecordDto[]) => ({
            items: expect.arrayContaining(expectedRecords),
            skip: 0,
            take: expect.any(Number),
            total: expectedRecords.length
        })

        // 필터가 제공될 때
        describe('when the filter is provided', () => {
            const queryAndExpect = async (
                query: SearchWatchRecordsPageDto,
                expectedRecords: WatchRecordDto[]
            ) => {
                const recordsPage = await fix.watchRecordsClient.searchPage(query)
                expect(recordsPage).toEqual(buildExpectedPage(expectedRecords))
            }

            // customerId로 필터링된 기록을 반환한다
            it('returns records filtered by customerId', async () => {
                await queryAndExpect({ customerId }, [watchRecords[0], watchRecords[1]])
            })
        })
    })
})
