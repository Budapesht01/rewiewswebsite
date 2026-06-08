import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IReviewDoc extends Document {
  externalId: string
  externalSource: 'tmdb_movie' | 'tmdb_tv' | 'rawg'
  type: 'movie' | 'series' | 'game'
  userId: mongoose.Types.ObjectId
  criteria: Map<string, number>
  totalScore: number
  comment?: string
  createdAt: Date
  updatedAt: Date
}

const ReviewSchema = new Schema<IReviewDoc>(
  {
    externalId:     { type: String, required: true },
    externalSource: { type: String, enum: ['tmdb_movie', 'tmdb_tv', 'rawg'], required: true },
    type:           { type: String, enum: ['movie', 'series', 'game'], required: true },
    userId:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
    criteria:       { type: Map, of: Number, required: true },
    totalScore:     { type: Number, required: true },
    comment:        { type: String, maxlength: 2000 },
  },
  { timestamps: true }
)

ReviewSchema.index({ externalId: 1, externalSource: 1, userId: 1 }, { unique: true })
ReviewSchema.index({ userId: 1, createdAt: -1 })
ReviewSchema.index({ externalId: 1, externalSource: 1 })

const Review: Model<IReviewDoc> =
  mongoose.models.Review ?? mongoose.model<IReviewDoc>('Review', ReviewSchema)

export default Review
