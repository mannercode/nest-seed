import {
    createMovie,
    createMoviesAssetsFixture,
    uploadCompleteMovieAsset
} from './movies-assets.fixture'
import type { MoviesAssetsFixture } from './movies-assets.fixture'

export type MoviesPublishFixture = MoviesAssetsFixture

export const createMoviesPublishFixture = createMoviesAssetsFixture

export { createMovie, uploadCompleteMovieAsset }
