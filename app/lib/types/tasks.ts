export interface TaskBoard {
  id: string
  name: string
  description?: string
  created_by: string
  created_at: string
  updated_at: string
  archived: number
  company_wide?: number
  lists?: TaskList[]
}

export interface TaskList {
  id: string
  board_id: string
  name: string
  color?: string
  position: number
  archived: number
  created_at: string
  cards?: TaskCard[]
}

export interface TaskCardAttachment {
  id: string
  filename: string
  original_filename: string
  mime_type: string
  size: number
  path: string
  uploaded_by: string
  created_at: string
}

export interface TaskCard {
  id: string
  list_id: string
  title: string
  description?: string
  position: number
  due_date?: string
  project_id?: string
  resource_id?: string
  created_by: string
  created_at: string
  updated_at: string
  archived: number
  labels?: TaskLabel[]
  members?: TaskCardMember[]
  attachments?: TaskCardAttachment[]
}

export interface TaskLabel {
  id: string
  card_id: string
  name: string
  color?: string
}

export interface TaskCardMember {
  id: string
  card_id: string
  user_id: string
  user_name: string
  user_email: string
  created_at: string
}

export interface BoardPermission {
  id: string
  board_id: string
  user_id: string
  user_name?: string
  user_email?: string
  role?: string
}
