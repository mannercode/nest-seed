import type { SearchWatchRecordsPageDto, WatchRecordDto } from 'core'
import { oid } from '@mannercode/testing'
import type { WatchRecordsFixture } from './watch-records.fixture'
import { buildCreateWatchRecordDto, createWatchRecord } from '../helpers'

describe('WatchRecordsService', () => {
    let fix: WatchRecordsFixture

    beforeEach(async () => {
        const { createWatchRecordsFixture } = await import('./watch-records.fixture')
        fix = await createWatchRecordsFixture()
    })
    afterEach(() => fix.teardown())

    describe('create', () => {
        it('생성된 시청 기록을 반환한다', async () => {
            const createDto = buildCreateWatchRecordDto()
            const watchRecord = await fix.watchRecordsService.create(createDto)

            expect(watchRecord).toEqual({ ...createDto, id: expect.any(String) })
        })
    })

    describe('searchPage', () => {
        const userId = oid(0xa1)
        let watchRecords: WatchRecordDto[]

        beforeEach(async () => {
            watchRecords = await Promise.all([
                createWatchRecord(fix, { userId }),
                createWatchRecord(fix, { userId }),
                createWatchRecord(fix, {}),
                createWatchRecord(fix, {})
            ])
        })

        const buildExpectedPage = (expectedRecords: WatchRecordDto[]) => ({
            items: expect.arrayContaining(expectedRecords),
            page: expect.any(Number),
            size: expect.any(Number),
            total: expectedRecords.length
        })

        describe('필터가 제공될 때', () => {
            const queryAndExpect = async (
                query: SearchWatchRecordsPageDto,
                expectedRecords: WatchRecordDto[]
            ) => {
                const recordsPage = await fix.watchRecordsService.searchPage(query)
                expect(recordsPage).toEqual(buildExpectedPage(expectedRecords))
            }

            it('userId로 필터링된 기록을 반환한다', async () => {
                await queryAndExpect({ userId }, [watchRecords[0], watchRecords[1]])
            })
        })
    })
})
