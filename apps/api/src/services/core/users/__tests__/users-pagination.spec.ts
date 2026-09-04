import { UsersRepository } from '../index.js'

describe('UsersRepository.searchPage', () => {
    it('null pagination 값을 undefined로 정규화하고 값이 있으면 유지한다', async () => {
        const repository = new UsersRepository(
            { client: {}, db: { collection: () => ({}) } } as any,
            { http: { paginationDefaultSize: 10, paginationMaxSize: 100 } } as any
        )
        const findWithPagination = vi
            .spyOn(repository, 'findWithPagination')
            .mockResolvedValue({ items: [], page: 1, size: 10, total: 0 })

        await repository.searchPage({ orderby: null, page: null, size: null })

        expect(findWithPagination).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                pagination: { orderby: undefined, page: undefined, size: undefined }
            })
        )

        const orderby = { direction: 'asc' as const, name: 'email' }
        await repository.searchPage({ orderby, page: 2, size: 20 })

        expect(findWithPagination).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ pagination: { orderby, page: 2, size: 20 } })
        )
    })
})
