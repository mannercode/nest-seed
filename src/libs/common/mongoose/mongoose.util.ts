import { ObjectId } from './mongoose.schema'

export const newObjectId = () => new ObjectId().toString()
export const objectId = (id: string) => new ObjectId(id)
export const objectIds = (ids: string[]) => ids.map((id) => objectId(id))
