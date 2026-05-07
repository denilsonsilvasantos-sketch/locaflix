import { useRef, useState } from 'react'
import { Upload, FileCheck, ExternalLink, Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface KYCDocumentFieldProps {
  userId: string
  fieldKey: string
  label: string
  hint?: string
  currentUrl?: string | null
  disabled?: boolean
  onSuccess: (url: string) => void
  accept?: string
}

export function KYCDocumentField({
  userId, fieldKey, label, hint, currentUrl, disabled = false, onSuccess,
  accept = 'image/*,.pdf',
}: KYCDocumentFieldProps) {
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [localUrl, setLocalUrl] = useState<string | null>(currentUrl ?? null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setErr(null)
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'bin'
      const path = `${userId}/${fieldKey}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('kyc')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadErr) throw uploadErr
      const { data: { publicUrl } } = supabase.storage.from('kyc').getPublicUrl(path)
      setLocalUrl(publicUrl)
      onSuccess(publicUrl)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao enviar. Tente novamente.')
    } finally {
      setUploading(false)
    }
  }

  const displayUrl = localUrl ?? currentUrl

  return (
    <div>
      <p className="text-xs font-semibold text-[#B3B3B3] uppercase tracking-wide mb-1">{label}</p>
      {hint && <p className="text-xs text-[#555] mb-2">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        disabled={disabled || uploading}
      />
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#2A2A2A] border border-[#333] rounded-xl text-sm text-[#B3B3B3] hover:border-[#555] hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {displayUrl ? 'Substituir arquivo' : 'Selecionar arquivo'}
        </button>
        {displayUrl && (
          <a
            href={displayUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:underline"
          >
            <FileCheck size={13} /> Ver arquivo <ExternalLink size={10} />
          </a>
        )}
      </div>
      {displayUrl && !err && !uploading && (
        <p className="text-[10px] text-[#46D369] mt-1.5">✓ Arquivo enviado</p>
      )}
      {err && (
        <p className="text-[10px] text-[#E50914] mt-1.5 flex items-center gap-1">
          <AlertCircle size={10} /> {err}
        </p>
      )}
    </div>
  )
}
