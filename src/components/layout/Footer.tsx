import { Link } from 'react-router-dom'
import { APP_ROUTES } from '../../constants'

export function Footer() {
  return (
    <footer className="bg-[#0A0A0A] border-t border-[#222] mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-1">
            <Link to={APP_ROUTES.HOME}>
              <span className="font-display text-2xl font-bold text-[#E50914]">LOCAFLIX</span>
            </Link>
            <p className="mt-3 text-sm text-[#666] leading-relaxed">
              Aluguel de imóveis por temporada com parcelamento via Pix. Sua viagem dos sonhos em parcelas que cabem no bolso.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Explorar</h4>
            <ul className="space-y-2">
              <FooterLink to={`${APP_ROUTES.HOME}?tipo=praia`} label="Imóveis na praia" />
              <FooterLink to={`${APP_ROUTES.HOME}?tipo=campo`} label="Imóveis no campo" />
              <FooterLink to={`${APP_ROUTES.HOME}?tipo=montanha`} label="Imóveis na montanha" />
              <FooterLink to={`${APP_ROUTES.HOME}?tipo=cidade`} label="Imóveis na cidade" />
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Anfitrião</h4>
            <ul className="space-y-2">
              <FooterLink to={APP_ROUTES.REGISTER} label="Anunciar meu imóvel" />
              <FooterLink to={APP_ROUTES.OWNER_DASHBOARD} label="Dashboard anfitrião" />
              <FooterLink to="#" label="Como funciona" />
              <FooterLink to="#" label="Termos para anfitriões" />
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Suporte</h4>
            <ul className="space-y-2">
              <FooterLink to="#" label="Central de ajuda" />
              <FooterLink to="#" label="Política de cancelamento" />
              <FooterLink to="#" label="Privacidade e LGPD" />
              <FooterLink to="#" label="Termos de uso" />
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-[#222] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#444]">
            © {new Date().getFullYear()} LOCAFLIX. Todos os direitos reservados.
          </p>
          <p className="text-xs text-[#444]">
            Pagamentos processados via Pix · Plataforma intermediadora de locações
          </p>
        </div>
      </div>
    </footer>
  )
}

function FooterLink({ to, label }: { to: string; label: string }) {
  return (
    <li>
      <Link to={to} className="text-sm text-[#666] hover:text-[#B3B3B3] transition-colors">
        {label}
      </Link>
    </li>
  )
}
