export type ContentType = 'movie' | 'series' | 'game'

export interface CriterionDef {
  key: string
  label: string
  multiplier: number
}

export interface RatingCriteria {
  [key: string]: number // score 1-10
}

export interface ITitle {
  _id: string
  title: string
  originalTitle?: string
  type: ContentType
  year: number
  genre: string[]
  description: string
  coverImage?: string
  createdAt: string
  updatedAt: string
  avgScore?: number
  ratingsCount?: number
}

export interface IReview {
  _id: string
  titleId: string
  userId: string
  user?: {
    _id: string
    username: string
  }
  criteria: RatingCriteria
  totalScore: number
  comment?: string
  createdAt: string
  updatedAt: string
}

export interface IUser {
  _id: string
  username: string
  email: string
  createdAt: string
  reviewsCount?: number
}

export interface SessionUser {
  id: string
  username: string
  email: string
}
