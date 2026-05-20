'use client'

import { useEffect, useState } from 'react'
import { isNativeApp, takeNativePhoto } from '@/lib/native-photo'

type EvidenceUploadProps = {
  uploading: boolean
  uploadMessage: string | null
  onUpload: (file: File) => void
}

export function EvidenceUpload({
  uploading,
  uploadMessage,
  onUpload,
}: EvidenceUploadProps) {
  const [native, setNative] = useState(false)

  useEffect(() => {
    isNativeApp().then(setNative)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onUpload(file)
    e.target.value = ''
  }

  async function handleNativeCamera() {
    try {
      const file = await takeNativePhoto()
      if (file) onUpload(file)
    } catch (err: any) {
      alert(err.message || 'Could not open camera')
    }
  }

  return (
    <div className="border p-4 rounded-xl bg-gray-50">
      <h2 className="font-bold mb-3 text-lg">Upload Evidence</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {native ? (
          <button
            type="button"
            disabled={uploading}
            onClick={handleNativeCamera}
            className="flex items-center justify-center gap-2 bg-black text-white py-4 px-4 rounded-xl font-medium active:scale-[0.98] transition-transform min-h-[52px] disabled:opacity-50"
          >
            <span aria-hidden>📷</span>
            {uploading ? 'Processing…' : 'Take Photo'}
          </button>
        ) : (
          <label className="flex items-center justify-center gap-2 bg-black text-white py-4 px-4 rounded-xl font-medium cursor-pointer active:scale-[0.98] transition-transform min-h-[52px]">
            <span aria-hidden>📷</span>
            {uploading ? 'Processing…' : 'Take Photo'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              disabled={uploading}
              onChange={handleChange}
            />
          </label>
        )}

        <label className="flex items-center justify-center gap-2 border-2 border-black text-black py-4 px-4 rounded-xl font-medium cursor-pointer active:scale-[0.98] transition-transform min-h-[52px]">
          <span aria-hidden>📎</span>
          {uploading ? 'Processing…' : 'Choose File'}
          <input
            type="file"
            className="sr-only"
            disabled={uploading}
            onChange={handleChange}
          />
        </label>
      </div>

      <p className="text-sm text-gray-600 mt-3 leading-relaxed">
        Photos, PDFs, Word docs, videos — up to 50 MB. AI categorizes and
        summarizes automatically.
      </p>

      {uploading && (
        <p className="mt-3 text-sm font-medium">
          Uploading, categorizing, and summarizing…
        </p>
      )}

      {uploadMessage && (
        <p
          className={`mt-3 text-sm leading-relaxed ${
            uploadMessage.startsWith('Uploaded')
              ? 'text-green-800'
              : 'text-red-700'
          }`}
        >
          {uploadMessage}
        </p>
      )}
    </div>
  )
}
