import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MongooseRepository } from 'common'
import { Model } from 'mongoose'
import { MongooseConfigModule } from 'shared'
import { MovieDraft, MovieDraftDocument, MovieDraftImage } from './models/movie-draft'

@Injectable()
export class MovieDraftsRepository extends MongooseRepository<MovieDraft> {
    constructor(
        @InjectModel(MovieDraft.name, MongooseConfigModule.connectionName)
        readonly model: Model<MovieDraft>
    ) {
        super(model, MongooseConfigModule.maxTake)
    }

    async createDraft() {
        const draft = this.newDocument()
        return draft.save()
    }

    async addOrUpdateImage(draftId: string, image: MovieDraftImage): Promise<MovieDraftDocument> {
        const draft = await this.getById(draftId)
        const existing = draft.images.find((img) => img.assetId === image.assetId)

        if (existing) {
            existing.status = image.status
        } else {
            draft.images.push(image)
        }

        await draft.save()
        return draft
    }
}

// export class PostsService {
//   constructor(@InjectModel(Post.name) private readonly postModel: Model<PostDocument>) {}

//   async addComment(postId: string, author: string, text: string) {
//     return this.postModel.findByIdAndUpdate(
//       postId,
//       { $push: { comments: { author, text } } },
//       { new: true },
//     );
//   }
// }
