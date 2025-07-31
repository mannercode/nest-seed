import { MovieDto } from 'apps/cores'
import {
    CommonFixture,
    createCommonFixture,
    createMovie,
    FixtureFile,
    fixtureFiles
} from '../__helpers__'

export interface Fixture extends CommonFixture {
    teardown: () => Promise<void>
    image: FixtureFile
    movie: MovieDto
}

export const createFixture = async () => {
    const fix = await createCommonFixture()

    const movie = await createMovie(fix)

    const teardown = async () => {
        await fix?.close()
    }

    return { ...fix, teardown, image: fixtureFiles.image, movie }
}
