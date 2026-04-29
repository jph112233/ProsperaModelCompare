'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface ExpandableTextareaProps {
  label: string
  value: string
  onChange: (v: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  rows?: number
  mono?: boolean
}

export default function ExpandableTextarea({
  label,
  value,
  onChange,
  onKeyDown,
  placeholder,
  rows = 3,
  mono = false,
}: ExpandableTextareaProps) {
  const [open, setOpen] = useState(false)
  const modalTextareaRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        const el = modalTextareaRef.current
        if (!el) return
        el.focus()
        el.setSelectionRange(el.value.length, el.value.length)
      })
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  const baseInputClass = `w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm
    text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500
    transition-colors resize-none ${mono ? 'font-mono text-xs' : ''}`

  return (
    <>
      {/* Preview textarea - clicking opens modal */}
      <div className="relative group">
        <textarea
          ref={previewRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          rows={rows}
          placeholder={placeholder}
          className={`${baseInputClass} cursor-pointer`}
          readOnly
        />
        {/* Expand hint */}
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </div>
      </div>

      {/* Modal */}
      {open && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Dialog - nearly full screen */}
          <div className="relative z-10 bg-slate-900 border border-slate-700 rounded-xl
            shadow-2xl flex flex-col" style={{ width: '92vw', height: '88vh' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-700 flex-shrink-0">
              <span className="text-sm font-semibold text-slate-200">{label}</span>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-400
                  hover:text-slate-200 transition-colors flex items-center justify-center"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Textarea - fills all remaining space */}
            <textarea
              ref={modalTextareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setOpen(false); return }
                onKeyDown?.(e)
              }}
              placeholder={placeholder}
              className={`flex-1 min-h-0 bg-transparent border-0 outline-none px-6 py-5 text-base
                text-slate-200 placeholder:text-slate-600 resize-none leading-relaxed
                ${mono ? 'font-mono text-sm' : ''}`}
            />

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-slate-700 bg-slate-900/50 flex-shrink-0">
              <span className="text-xs text-slate-600">
                {value.length} char{value.length !== 1 ? 's' : ''}
                {value.trim() ? ` - ${value.trim().split(/\s+/).length} words` : ''}
                <span className="ml-3 text-slate-700">Esc to close</span>
              </span>
              <button
                onClick={() => setOpen(false)}
                className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm
                  font-medium rounded transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
