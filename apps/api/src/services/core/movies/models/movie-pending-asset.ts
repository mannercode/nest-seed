import { CrudDocument } from '@mannercode/common'

export class MoviePendingAsset extends CrudDocument {
    assetId: string

    movieId: string
}
