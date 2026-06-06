import { Link } from 'react-router-dom'
import { APP_ROUTES } from '../../constants'
import { Logo } from './Logo'

export function Footer() {
  return (
    <footer className="bg-[#0A0A0A] border-t border-[#222] mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-1">
            <Link to={APP_ROUTES.HOME}>
              <Logo size="lg" />
            </Link>
            <p className="mt-3 text-sm text-[#999] leading-relaxed">
              Aluguel de imóveis por temporada com parcelamento via Pix e Boleto. Sua viagem dos sonhos em parcelas que cabem no bolso.
            </p>
          </div>

          {/* Para hóspedes */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Para hóspedes</h4>
            <ul className="space-y-2">
              <FooterLink to="/como-funciona" label="Como funciona" />
              <FooterLink to={APP_ROUTES.HOME} label="Buscar imóveis" />
              <FooterLink to="/politica-cancelamento" label="Política de cancelamento" />
            </ul>
          </div>

          {/* Anfitrião */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Anfitrião</h4>
            <ul className="space-y-2">
              <FooterLink to="/tornar-anfitriao" label="Torne-se um anfitrião" />
              <FooterLink to={APP_ROUTES.OWNER_DASHBOARD} label="Painel do anfitrião" />
              <FooterLink to="/termos-anfitriao" label="Termos para anfitriões" />
            </ul>
          </div>

          {/* Suporte */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Suporte</h4>
            <ul className="space-y-2">
              <FooterLink to="/privacidade" label="Privacidade e LGPD" />
              <FooterLink to="/termos-uso" label="Termos de uso" />
              <FooterLink to="/central-ajuda" label="Central de ajuda" />
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-[#222] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#444]">
            © {new Date().getFullYear()} LOCAFLIX. Todos os direitos reservados.
          </p>
          <p className="text-xs text-[#444]">
            Pagamentos processados via Pix e Boleto · Plataforma intermediadora de locações
          </p>
        </div>
      </div>
    </footer>
  )
}

function FooterLink({ to, label }: { to: string; label: string }) {
  return (
    <li>
      <Link to={to} className="text-sm text-[#999] hover:text-[#B3B3B3] transition-colors">
        {label}
      </Link>
    </li>
  )
}
