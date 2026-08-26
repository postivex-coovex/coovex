'use client'

import { Trash2 } from 'lucide-react'

export function DeletePropertyButton({ id }: { id: string }) {
  function handleDelete() {
    if (!confirm('Are you sure? This will delete all conversations and data for this property.')) return
    fetch(`/api/support/properties/${id}`, { method: 'DELETE' })
      .then(r => { if (r.ok) window.location.href = '/support/properties' })
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
    >
      <Trash2 className="w-3.5 h-3.5" />
      Delete Property
    </button>
  )
}
