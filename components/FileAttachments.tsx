'use client'

import { useRef, useState } from 'react'
import type { Attachment } from '@/lib/api'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
const TEXT_TYPES = [
  'text/plain', 'text/markdown', 'text/csv', 'text/html', 'text/css',
  'application/json', 'application/xml', 'application/javascript',
]
const TEXT_EXTS = ['.txt', '.md', '.csv', '.json', '.xml', '.yaml', '.yml',
  '.js', '.ts', '.tsx', '.jsx', '.py', '.rb', '.go', '.rs', '.java',
  '.c', '.cpp', '.h', '.cs', '.sh', '.bash', '.zsh', '.env', '.toml',
  '.ini', '.cfg', '.log', '.sql', '.graphql', '.html', '.css']

const MAX_FILE_MB = 20

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isTextFile(file: File): boolean {
  if (TEXT_TYPES.includes(file.type)) return true
  const lower = file.name.toLowerCase()
  return TEXT_EXTS.some((ext) => lower.endsWith(ext))
}

function isImageFile(file: File): boolean {
  return IMAGE_TYPES.includes(file.type)
}

let nextAttId = 1
function attId() { return `att-${nextAttId++}` }

async function readFile(file: File): Promise<Attachment | null> {
  if (file.size > MAX_FILE_MB * 1024 * 1024) return null

  return new Promise((resolve) => {
    const reader = new FileReader()

    if (isImageFile(file)) {
      reader.onload = () => {
        resolve({
          id: attId(),
          name: file.name,
          kind: 'image',
          mimeType: file.type,
          dataUrl: reader.result as string,
          size: file.size,
        })
      }
      reader.readAsDataURL(file)
    } else if (isTextFile(file)) {
      reader.onload = () => {
        const text = reader.result as string
        resolve({
          id: attId(),
          name: file.name,
          kind: 'text',
          mimeType: file.type || 'text/plain',
          dataUrl: `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`,
          text,
          size: file.size,
        })
      }
      reader.readAsText(file)
    } else {
      resolve(null)
    }
  })
}

interface FileAttachmentsProps {
  attachments: Attachment[]
  onChange: (attachments: Attachment[]) => void
}

export default function FileAttachments({ attachments, onChange }: FileAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  async function processFiles(files: FileList | File[]) {
    const arr = Array.from(files)
    const errs: string[] = []
    const results: Attachment[] = []

    for (const file of arr) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        errs.push(`${file.name}: exceeds ${MAX_FILE_MB} MB limit`)
        continue
      }
      if (!isImageFile(file) && !isTextFile(file)) {
        errs.push(`${file.name}: unsupported type`)
        continue
      }
      const att = await readFile(file)
      if (att) results.push(att)
    }

    setErrors(errs)
    if (results.length) onChange([...attachments, ...results])
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    processFiles(e.dataTransfer.files)
  }

  function remove(id: string) {
    onChange(attachments.filter((a) => a.id !== id))
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex items-center gap-2 px-3 py-2 rounded border border-dashed cursor-pointer
          transition-colors text-xs
          ${dragging
            ? 'border-emerald-500 bg-emerald-950 text-emerald-400'
            : 'border-slate-600 hover:border-slate-500 text-slate-500 hover:text-slate-400'
          }`}
      >
        <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
        <span>
          {dragging ? 'Drop files here' : 'Attach files - images, text, code (click or drag)'}
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={[...IMAGE_TYPES, ...TEXT_TYPES, ...TEXT_EXTS].join(',')}
          className="hidden"
          onChange={(e) => { if (e.target.files) processFiles(e.target.files); e.target.value = '' }}
        />
      </div>

      {/* Error messages */}
      {errors.map((err, i) => (
        <div key={i} className="text-xs text-red-400 flex items-center gap-1.5 px-1">
          <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          {err}
        </div>
      ))}

      {/* Attached file chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((att) => (
            <div key={att.id} className="group relative flex items-center gap-2 bg-slate-800
              border border-slate-700 rounded-lg overflow-hidden max-w-full">

              {att.kind === 'image' ? (
                // Image thumbnail
                <div className="h-12 w-12 flex-shrink-0 overflow-hidden bg-slate-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={att.dataUrl} alt={att.name} className="h-full w-full object-cover" />
                </div>
              ) : (
                // Text file icon
                <div className="h-12 w-12 flex-shrink-0 flex items-center justify-center bg-slate-700">
                  <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              )}

              <div className="flex flex-col justify-center pr-8 py-1 min-w-0">
                <span className="text-xs font-medium text-slate-300 truncate max-w-[140px]">{att.name}</span>
                <span className="text-xs text-slate-600">{formatBytes(att.size)}</span>
              </div>

              {/* Remove button */}
              <button
                onClick={() => remove(att.id)}
                className="absolute top-1 right-1 w-5 h-5 rounded bg-slate-900/80 hover:bg-red-900
                  text-slate-500 hover:text-red-300 transition-colors flex items-center justify-center
                  opacity-0 group-hover:opacity-100"
                title="Remove"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
