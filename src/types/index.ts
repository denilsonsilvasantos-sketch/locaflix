// ============================================================
// LOCAFLIX — TypeScript Types
// ============================================================

export type UserRole = 'GUEST' | 'OWNER' | 'ADMIN'
export type KYCStatus = 'PENDENTE' | 'APROVADO' | 'REPROVADO' | 'INCOMPLETO'
export type PropertyStatus = 'PENDENTE' | 'ATIVO' | 'INATIVO' | 'REPROVADO'
export type PropertyPlan = 'STANDARD' | 'DESTAQUE'
export type PropertyType = 'CASA' | 'APARTAMENTO' | 'CHALÉ' | 'POUSADA' | 'SÍTIO' | 'COBERTURA' | 'LOFT' | 'STUDIO'
export type CancellationPolicy = 'FLEXIVEL' | 'MODERADO' | 'FIRME'
export type BookingStatus = 'AGUARDANDO_PAGAMENTO' | 'PARCIAL' | 'PAGO' | 'CONCLUIDA' | 'CANCELADA'
export type InstallmentStatus = 'PENDENTE' | 'PAGO' | 'ATRASADO' | 'CANCELADO'
export type InstallmentType = 'ENTRADA' | 'PARCELA'
export type ReviewMode = 'OWNER_RATES_GUEST' | 'GUEST_RATES_PROPERTY'
export type CouponType = 'PERCENTUAL' | 'FIXO'
export type PricingRuleType = 'WEEKEND' | 'HOLIDAY' | 'SPECIAL' | 'LOW_SEASON' | 'HIGH_SEASON'
export type OwnershipType = 'PROPRIO' | 'TERCEIRO'
export type KinshipType = 'PAI' | 'MAE' | 'ESPOSO' | 'ESPOSA' | 'FILHO' | 'FILHA' | 'OUTRO'

// ---- User Profile ----
export interface UserProfile {
  id: string
  email: string
  name: string | null
  role: UserRole
  kyc_status: KYCStatus
  cpf: string | null
  birth_date: string | null
  phone: string | null
  address: string | null
  number: string | null
  complement: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  cep: string | null
  document_url: string | null
  address_proof_url: string | null
  avatar_url: string | null
  actual_owner_name: string | null
  actual_owner_cpf: string | null
  actual_owner_document_url: string | null
  ownership_type: OwnershipType | null
  kinship_type: KinshipType | null
  kinship_document_url: string | null
  tour_completed: boolean
  cookie_accepted: boolean
  terms_accepted_at: string | null
  created_at: string
  updated_at: string
}

// ---- Property ----
export interface Property {
  id: string
  owner_id: string
  name: string
  description: string | null
  type: PropertyType
  status: PropertyStatus
  plan: PropertyPlan
  city: string
  state: string
  neighborhood: string | null
  address: string | null
  cep: string | null
  number: string | null
  complement: string | null
  country: string
  latitude: number | null
  longitude: number | null
  price_per_night: number
  min_price: number | null
  bedrooms: number
  bathrooms: number
  max_guests: number
  amenities: string[]
  photos: string[]
  cancellation_policy: CancellationPolicy
  rating: number | null
  reviews_count: number
  created_at: string
  updated_at: string
  // joined
  owner?: UserProfile
}

// ---- Booking ----
export interface Booking {
  id: string
  property_id: string
  guest_id: string
  owner_id: string
  check_in: string
  check_out: string
  nights: number
  total_guests: number
  subtotal: number
  platform_fee: number
  discount_amount: number
  total_price: number
  coupon_code: string | null
  status: BookingStatus
  booking_number: string | null
  created_at: string
  updated_at: string
  // joined
  property?: Property
  guest?: UserProfile
  owner?: UserProfile
  installments?: Installment[]
  contract?: Contract
}

// ---- Installment ----
export interface Installment {
  id: string
  booking_id: string
  number: number
  value: number
  due_date: string
  status: InstallmentStatus
  type: InstallmentType
  asaas_payment_id: string | null
  asaas_customer_id: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

// ---- Contract ----
export interface Contract {
  id: string
  booking_id: string
  guest_id: string
  owner_id: string
  content: string
  ip_address: string | null
  user_agent: string | null
  accepted_at: string | null
  version: string
  created_at: string
  updated_at: string
}

// ---- Message ----
export interface Message {
  id: string
  booking_id: string | null
  sender_id: string
  receiver_id: string
  content: string
  subject: string | null
  is_read: boolean
  created_at: string
  updated_at: string
  sender?: UserProfile
  receiver?: UserProfile
}

// ---- Review ----
export interface Review {
  id: string
  booking_id: string
  reviewer_id: string
  target_property_id: string | null
  target_user_id: string | null
  rating: number
  cleanliness: number | null
  communication: number | null
  location: number | null
  cost_benefit: number | null
  comment: string | null
  mode: ReviewMode
  visible: boolean
  created_at: string
  updated_at: string
  reviewer?: UserProfile
}

// ---- Notification ----
export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'PAYMENT' | 'BOOKING'
  is_read: boolean
  created_at: string
  updated_at: string
}

// ---- Favorite ----
export interface Favorite {
  id: string
  user_id: string
  property_id: string
  created_at: string
  property?: Property
}

// ---- Coupon ----
export interface Coupon {
  id: string
  code: string
  type: CouponType
  value: number
  min_booking_value: number
  max_uses: number
  current_uses: number
  expires_at: string | null
  active: boolean
  created_at: string
  updated_at: string
}

// ---- Property Pricing Rule ----
export interface PropertyPricingRule {
  id: string
  property_id: string
  rule_type: PricingRuleType
  multiplier: number
  specific_dates: string[] | null
  start_date: string | null
  end_date: string | null
  created_at: string
  updated_at: string
}

// ---- Availability Block ----
export interface AvailabilityBlock {
  id: string
  property_id: string
  start_date: string
  end_date: string
  reason: string | null
  created_at: string
  updated_at: string
}

// ---- Checkout types ----
export interface CheckoutFormData {
  // step 1: policy accepted
  policy_accepted: boolean
  // step 2: personal data
  name: string
  cpf: string
  birth_date: string
  phone: string
  address: string
  number: string
  complement: string
  city: string
  state: string
  cep: string
  // step 3: contract
  contract_accepted: boolean
  // step 5: payment
  payment_method: 'PIX' | 'BOLETO'
  installments_count: number
}

export interface InstallmentPreview {
  number: number
  value: number
  due_date: string
  type: InstallmentType
}

// ---- Search / Filter ----
export interface SearchFilters {
  state?: string
  city?: string
  neighborhood?: string
  check_in?: string
  check_out?: string
  guests?: number
  min_price?: number
  max_price?: number
  type?: PropertyType
  bedrooms?: number
  amenities?: string[]
}

// ---- Admin KPIs ----
export interface AdminKPIs {
  gmv: number
  platform_revenue: number
  total_bookings: number
  active_users: number
  active_properties: number
  pending_kyc: number
  pending_properties: number
  conversion_rate: number
}

// ---- Guests breakdown ----
export interface GuestsBreakdown {
  adults: number
  children: number
  babies: number
  pets: number
}

// ---- Auth context ----
export interface AuthContextValue {
  user: import('@supabase/supabase-js').User | null
  profile: UserProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<UserProfile | null>
  signUp: (email: string, password: string, name: string, role: UserRole, extra?: Partial<UserProfile>) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

// ---- Pix Payment ----
export interface PixPaymentResponse {
  payment_id: string
  status: string
  pix_key: string
  pix_qr_code: string
  due_date: string
  value: number
}

// ---- Toast ----
export type ToastType = 'success' | 'error' | 'warning' | 'info'
export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}
