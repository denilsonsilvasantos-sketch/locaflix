import { useEffect, useState } from 'react'
import { X, ExternalLink, ImageOff } from 'lucide-react'

function isPdf(src: string) {
  return /\.pdf(\?.*)?$/i.test(src)
}

export function Lightbox({ src, onClose }: { src: string | null; onClose: () => void }) {
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    setImgError(false)
    if (!src) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [src, onClose])

  if (!src) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 cursor-zoom-out"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
      >
        <X size={16} />
      </button>

      {isPdf(src) ? (
        <div className="text-center cursor-default space-y-4" onClick={e => e.stopPropagation()}>
          <p className="text-[#B3B3B3] text-sm">Arquivo PDF</p>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 bg-[#E50914] hover:bg-[#F40612] text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <ExternalLink size={15} /> Abrir PDF em nova aba
          </a>
        </div>
      ) : imgError ? (
        <div className="text-center cursor-default space-y-3" onClick={e => e.stopPropagation()}>
          <ImageOff size={40} className="mx-auto text-[#555]" />
          <p className="text-[#B3B3B3] text-sm">Não foi possível carregar a imagem</p>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 border border-[#333] text-[#B3B3B3] hover:text-white rounded-xl text-sm transition-colors"
          >
            <ExternalLink size={14} /> Abrir em nova aba
          </a>
        </div>
      ) : (
        <img
          src={src}
          alt=""
          className="max-w-full max-h-[90vh] rounded-xl object-contain cursor-default"
          onClick={e => e.stopPropagation()}
          onError={() => setImgError(true)}
        />
      )}
    </div>
  )
}
