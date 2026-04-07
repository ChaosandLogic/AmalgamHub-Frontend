/**
 * Current user shape returned by GET /api/user. Used by useUser and components that need role/id.
 */

export interface CurrentUser {
  id: string
  name: string
  email: string
  role: string
  created_at?: string
  createdAt?: string
}
