import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, createMongooseSchema } from 'common'

@Schema()
export class Customer extends MongooseSchema {
    @Prop({ required: true })
    name: string

    @Prop({ unique: true, required: true })
    email: string

    @Prop({ required: true })
    birthdate: Date

    @Prop({ required: true })
    password: string
}

export const CustomerSchema = createMongooseSchema(Customer)
CustomerSchema.index({ email: 1 })
CustomerSchema.index({ name: 'text' })

/*
1. `CustomerSchema.index({ email: 1 })`
   This command creates an ascending (1) index on the `email` field.
   - Purpose: Enables quick customer searches by email address.
   - How it works: MongoDB stores email addresses in an alphabetically sorted structure.
   - Advantages:
     - Greatly improves the performance of queries like `findByEmail`.
     - Allows for fast email duplication checks.
   - Usage example: `db.customers.find({ email: "example@email.com" })`
   - Note: While indexing might slightly decrease write operation performance, the benefits for read operations outweigh this.

2. `CustomerSchema.index({ name: 'text' })`
   This command creates a text index on the `name` field.
   - Purpose: Enables full-text search on customer names.
   - How it works: MongoDB indexes each word in the name field individually.
   - Advantages:
     - Efficiently performs complex name searches including partial matches and multi-word searches.
     - Provides relevance scores for search results.
   - Usage example: `db.customers.find({ $text: { $search: "John Doe" } })`
   - Features:
     - Case-insensitive.
     - Removes stop words by default.
     - Supports stemming, allowing for searches of similar words.
*/
