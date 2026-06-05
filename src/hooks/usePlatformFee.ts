import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type FeeModel = 'dividido' | 'unico'

export interface PlatformFeeSettings {
  feeModel: FeeModel
  /** Percentual como decimal (ex: 0.05 para 5%). Zero quando modelo é único. */
  guestFeePercent: number
  hostFeePercent: number
}

const DEFAULTS: PlatformFeeSettings = {
  feeModel: 'dividido',
  guestFeePercent: 0.05,
  hostFeePercent: 0.04,
}

let _cache: PlatformFeeSettings | null = null

export function usePlatformFee(): PlatformFeeSettings {
  const [settings, setSettings] = useState<PlatformFeeSettings>(_cache ?? DEFAULTS)

  useEffect(() => {
    if (_cache) return
    supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', ['fee_model', 'guest_fee_split', 'host_fee_split', 'host_fee_single'])
      .then(({ data }) => {
        if (!data) return
        const map = Object.fromEntries(
          (data as { key: string; value: string }[]).map(r => [r.key, r.value])
        )
        const model: FeeModel = map.fee_model === 'unico' ? 'unico' : 'dividido'
        const result: PlatformFeeSettings = model === 'unico'
          ? {
            feeModel: 'unico',
            guestFeePercent: 0,
            hostFeePercent: parseFloat(map.host_fee_single ?? '16') / 100,
          }
          : {
            feeModel: 'dividido',
            guestFeePercent: parseFloat(map.guest_fee_split ?? '5') / 100,
            hostFeePercent: parseFloat(map.host_fee_split ?? '4') / 100,
          }
        _cache = result
        setSettings(result)
      })
  }, [])

  return settings
}
