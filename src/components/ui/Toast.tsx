import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import type { ToastType } from '../../types'

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={18} className="text-[#46D369]" />,
  error: <AlertCircle size={18} className="text-[#E50914]" />,
  warning: <AlertTriangle size={18} className="text-[#F5A623]" />,
  info: <Info size={18} className="text-blue-400" />,
}

const borderColors: Record<ToastType, string> = {
  success: 'border-l-[#46D369]',
  error: 'border-l-[#E50914]',
  warning: 'border-l-[#F5A623]',
  info: 'border-l-blue-400',
}

export function ToastContainer() {
  const { toasts, dismiss } = useToast()

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 80, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className={`pointer-events-auto flex items-start gap-3 bg-[#1F1F1F] border border-[#333] border-l-4 ${borderColors[t.type]} rounded-lg p-4 shadow-2xl min-w-[300px] max-w-[380px]`}
          >
            <div className="flex-shrink-0 mt-0.5">{icons[t.type]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">{t.title}</p>
              {t.message && <p className="text-xs text-[#B3B3B3] mt-0.5">{t.message}</p>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="flex-shrink-0 text-[#666] hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
