import mongoose, { Schema, Document, Model } from 'mongoose'
import { ContentType } from '@/types'

export interface ITitleDoc extends Document {
  title: string
  originalTitle?: string
  type: ContentType
  year: number
  genre: string[]
  description: string
  coverImage?: string
  addedBy: mongoose.Types.ObjectId
  avgScore: number
  ratingsCount: number
  createdAt: Date
  updatedAt: Date
}

const TitleSchema = new Schema<ITitleDoc>(
  {
    title:         { type: String, required: true, trim: true },
    originalTitle: { type: String, trim: true },
    type:          { type: String, enum: ['movie', 'series', 'game'], required: true },
    year:          { type: Number, required: true },
    genre:         [{ type: String }],
    description:   { type: String, default: '' },
    coverImage:    { type: String },
    addedBy:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    avgScore:      { type: Number, default: 0 },
    ratingsCount:  { type: Number, default: 0 },
  },
  { timestamps: true }
)

TitleSchema.index({ title: 'text', originalTitle: 'text' })
TitleSchema.index({ type: 1 })
TitleSchema.index({ avgScore: -1 })

const Title: Model<ITitleDoc> =
  mongoose.models.Title ?? mongoose.model<ITitleDoc>('Title', TitleSchema)

export default Title
