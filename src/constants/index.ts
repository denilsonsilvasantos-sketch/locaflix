export const APP_ROUTES = {
  HOME: '/',
  LOGIN: '/entrar',
  REGISTER: '/cadastro',
  PROPERTY: (id: string) => `/imovel/${id}`,
  CHECKOUT: (id: string) => `/reservar/${id}`,
  GUEST_DASHBOARD: '/minha-conta',
  OWNER_DASHBOARD: '/anfitriao',
  ADMIN_DASHBOARD: '/admin',
  NEW_PROPERTY: '/anfitriao/novo-imovel',
  EDIT_PROPERTY: (id: string) => `/editar-imovel/${id}`,
  MESSAGES: '/mensagens',
  BOOKING: (id: string) => `/reserva/${id}`,
} as const

export const AMENITIES_LIST = [
  'Wi-Fi',
  'Piscina',
  'Churrasqueira',
  'Ar-condicionado',
  'Estacionamento',
  'Cozinha equipada',
  'Lavanderia',
  'TV a cabo',
  'Jardim',
  'Varanda',
  'Academia',
  'Sauna',
  'Jacuzzi',
  'Fogueira',
  'Acessível para cadeirantes',
  'Permitido pets',
  'Playground',
  'Segurança 24h',
  'Gerador',
  'Área gourmet',
] as const

export const PROPERTY_TYPES = [
  { value: 'CASA', label: 'Casa' },
  { value: 'APARTAMENTO', label: 'Apartamento' },
  { value: 'CHALÉ', label: 'Chalé' },
  { value: 'POUSADA', label: 'Pousada' },
  { value: 'SÍTIO', label: 'Sítio / Fazenda' },
  { value: 'COBERTURA', label: 'Cobertura' },
  { value: 'LOFT', label: 'Loft' },
  { value: 'STUDIO', label: 'Studio' },
] as const

export const BRASIL_STATES = [
  { uf: 'AC', name: 'Acre' },
  { uf: 'AL', name: 'Alagoas' },
  { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' },
  { uf: 'BA', name: 'Bahia' },
  { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' },
  { uf: 'ES', name: 'Espírito Santo' },
  { uf: 'GO', name: 'Goiás' },
  { uf: 'MA', name: 'Maranhão' },
  { uf: 'MT', name: 'Mato Grosso' },
  { uf: 'MS', name: 'Mato Grosso do Sul' },
  { uf: 'MG', name: 'Minas Gerais' },
  { uf: 'PA', name: 'Pará' },
  { uf: 'PB', name: 'Paraíba' },
  { uf: 'PR', name: 'Paraná' },
  { uf: 'PE', name: 'Pernambuco' },
  { uf: 'PI', name: 'Piauí' },
  { uf: 'RJ', name: 'Rio de Janeiro' },
  { uf: 'RN', name: 'Rio Grande do Norte' },
  { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'RO', name: 'Rondônia' },
  { uf: 'RR', name: 'Roraima' },
  { uf: 'SC', name: 'Santa Catarina' },
  { uf: 'SP', name: 'São Paulo' },
  { uf: 'SE', name: 'Sergipe' },
  { uf: 'TO', name: 'Tocantins' },
] as const

export const CANCELLATION_POLICIES = [
  {
    value: 'FLEXIVEL',
    label: 'Flexível',
    description: 'Reembolso total até 24h antes do check-in.',
  },
  {
    value: 'MODERADO',
    label: 'Moderado',
    description: 'Reembolso total até 5 dias antes. 50% entre 2-5 dias.',
  },
  {
    value: 'FIRME',
    label: 'Firme',
    description: 'Reembolso total até 14 dias antes. 50% entre 7-14 dias.',
  },
] as const

export const PLATFORM_FEE_PERCENT = 0.05

export const NETFLIX_CATEGORIES = [
  { id: 'destaque', label: 'Em Destaque' },
  { id: 'praia', label: 'Na Beira da Praia' },
  { id: 'campo', label: 'No Campo' },
  { id: 'montanha', label: 'Na Montanha' },
  { id: 'cidade', label: 'Na Cidade' },
  { id: 'luxo', label: 'Luxo & Exclusividade' },
  { id: 'familia', label: 'Para a Família' },
] as const
