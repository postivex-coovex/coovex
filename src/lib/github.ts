import { createClient } from '@/lib/supabase/server'

export interface GitHubConfig {
  token: string
  username: string
  avatar_url?: string
  active_repo?: ActiveRepo
}

export interface ActiveRepo {
  owner: string
  repo: string
  branch: string
  full_name: string
}

export interface Repo {
  id: number
  name: string
  full_name: string
  description: string | null
  private: boolean
  language: string | null
  default_branch: string
  updated_at: string
}

export interface StagedFile {
  path: string
  content: string
}

export function ghFetch(url: string, token: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'CooVex/1.0',
      ...(options.headers ?? {}),
    },
  })
}

// Get the current user's GitHub config from their profile
export async function getUserGithubConfig(): Promise<GitHubConfig | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('github_config')
    .eq('id', user.id)
    .single()
  const gh = (profile as Record<string, unknown>)?.github_config
  if (!gh || !(gh as GitHubConfig).token) return null
  return gh as GitHubConfig
}

// Save updated config (e.g. when active_repo changes) back to the user's profile
export async function saveUserGithubConfig(config: GitHubConfig): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('profiles').update({ github_config: config }).eq('id', user.id)
}
