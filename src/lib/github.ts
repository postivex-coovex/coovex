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
