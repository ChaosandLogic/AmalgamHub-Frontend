export interface GanttTask {
  id: string
  title: string
  description?: string
  project_id?: string
  board_id?: string
  assignee_id?: string
  start_date: string
  end_date: string
  color: string
  percent_complete: number
  created_by?: string
  created_at?: string
  updated_at?: string
}
