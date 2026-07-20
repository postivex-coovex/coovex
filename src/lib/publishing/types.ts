export interface PostPayload {
  title: string
  content: string // HTML
  slug: string
  meta_title?: string
  meta_description?: string
  tags?: string[]
  featured_image_url?: string
  status?: 'draft' | 'publish' | 'published'
}

export interface PublishResult {
  integration: string
  success: boolean
  url?: string
  error?: string
  external_id?: string
}
