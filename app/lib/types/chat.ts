/**
 * Types for chat feature: channels, messages, users. Used by chat page and chat components.
 */

export interface ChatReaction {
  id: string
  emoji: string
  user_id: string
  user_name: string
  created_at: string
}

export interface ChatAttachment {
  id: string
  message_id: string
  filename: string
  original_filename: string
  mime_type: string
  size: number
  path: string
  uploaded_by: string
  created_at: string
}

export interface ChatMessage {
  id: string
  content: string
  user_name: string
  user_email: string
  user_role: string
  created_at: string
  edited_at?: string
  reply_to_id?: string
  channel_id?: string
  reactions?: ChatReaction[]
  attachments?: ChatAttachment[]
}

export type ChatChannelType = 'project' | 'team' | 'company' | 'group'

export interface ChatChannel {
  id: string
  name: string
  type: ChatChannelType
  project_id?: string
  department?: string
  created_by?: string
  unread_count: number
}

export interface ChatUser {
  id: string
  name: string
  email: string
}
