import { MovieDto } from 'apps/cores'
import { createMovie, TestFile, TestFiles } from '../__fixtures__'
import { CommonFixture, createCommonFixture } from '../__helpers__'

export interface Fixture extends CommonFixture {
    teardown: () => Promise<void>
    image: TestFile
    movie: MovieDto
}

export const createFixture = async () => {
    const fix = await createCommonFixture()

    const movie = await createMovie(fix)

    const teardown = async () => {
        await fix?.close()
    }

    return { ...fix, teardown, image: TestFiles.image, movie }
}
