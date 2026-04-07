export interface Notification {
  id: string
  user_id?: string
  type: string
  title: string
  message?: string
  link?: string
  read: boolean
  created_at: string
}
