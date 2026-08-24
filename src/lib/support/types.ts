export type ConversationStatus = 'open' | 'pending' | 'closed' | 'spam'
export type ConversationSource = 'widget' | 'email' | 'api'
export type SenderType = 'customer' | 'agent' | 'ai'
export type ResourceCategory = 'credential' | 'note' | 'link' | 'document' | 'api_key' | 'other'

export interface SupportProperty {
  id: string
  user_id: string
  name: string
  domain: string | null
  api_key: string
  smtp_host: string | null
  smtp_port: number
  smtp_user: string | null
  smtp_password: string | null
  smtp_secure: boolean
  from_email: string | null
  from_name: string | null
  widget_color: string
  widget_position: string
  widget_title: string
  widget_subtitle: string
  welcome_message: string
  inbound_email: string | null
  auto_reply_enabled: boolean
  auto_reply_message: string | null
  created_at: string
  updated_at: string
}

export interface SupportConversation {
  id: string
  property_id: string
  user_id: string
  customer_email: string | null
  customer_name: string | null
  customer_phone: string | null
  subject: string | null
  status: ConversationStatus
  source: ConversationSource
  is_read: boolean
  last_message_at: string
  email_thread_id: string | null
  widget_session_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  // joined
  property?: Pick<SupportProperty, 'id' | 'name' | 'domain' | 'widget_color' | 'from_email' | 'smtp_host'>
  last_message?: string
  unread_count?: number
}

export interface SupportMessage {
  id: string
  conversation_id: string
  property_id: string
  sender_type: SenderType
  sender_name: string | null
  sender_email: string | null
  content: string
  content_html: string | null
  source: ConversationSource | 'system'
  attachments: unknown[]
  email_message_id: string | null
  is_read: boolean
  created_at: string
}

export interface SupportResource {
  id: string
  property_id: string
  user_id: string
  name: string
  category: ResourceCategory
  content: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}
