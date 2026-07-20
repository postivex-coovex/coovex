export interface GeoIntelligence {
  prompt_examples: {
    prompt: string
    ai: 'ChatGPT' | 'Perplexity' | 'Claude' | 'Gemini' | 'Any AI'
    category: 'discovery' | 'comparison' | 'how-to' | 'best-of' | 'brand'
    likelihood: 'high' | 'medium' | 'low'
  }[]
  topic_clusters: {
    topic: string
    subtopics: string[]
    coverage: 'strong' | 'weak' | 'missing'
    suggested_url: string
  }[]
  content_gaps: {
    type: 'comparison' | 'faq' | 'case-study' | 'listicle' | 'how-to' | 'landing' | 'guide' | 'integration-guide' | 'use-case' | 'competitive-positioning' | 'brand-entity'
    suggestion: string
    impact: 'high' | 'medium' | 'low'
  }[]
  entity_score: number
  entity_notes: string
  ai_voice_summary: string
  generated_at: string
  actual_ai_visibility?: {
    checks: {
      query: string
      ai: string
      found: boolean
      response_snippet: string
      sources: string[]
      search_queries?: string[]
    }[]
    visibility_rate: number
    checked_at: string
  } | null
}
