export function TermsOfUse() {
  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl font-bold text-white mb-2">Termos de Uso</h1>
        <p className="text-xs text-[#555] mb-8">Última atualização: janeiro de 2025</p>

        <div className="space-y-8 text-[#B3B3B3] text-sm leading-relaxed">
          <section>
            <h2 className="font-display text-lg font-bold text-white mb-3">1. Aceitação dos Termos</h2>
            <p>Ao criar uma conta ou utilizar a plataforma LOCAFLIX, você concorda com estes Termos de Uso. Se não concordar, não utilize a plataforma.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-white mb-3">2. Descrição do Serviço</h2>
            <p>A LOCAFLIX é uma plataforma intermediadora de aluguel de imóveis por temporada. Conectamos hóspedes que buscam acomodação e anfitriões que desejam anunciar seus imóveis. A LOCAFLIX não é proprietária dos imóveis listados e não é parte no contrato de locação entre hóspede e anfitrião.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-white mb-3">3. Cadastro e Conta</h2>
            <p>Você é responsável por manter a confidencialidade da sua senha e por todas as atividades realizadas com sua conta. Notifique-nos imediatamente sobre qualquer uso não autorizado. Contas com informações falsas podem ser suspensas permanentemente.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-white mb-3">4. Reservas e Pagamentos</h2>
            <p>Ao confirmar uma reserva, você celebra um acordo de locação temporária diretamente com o anfitrião. A LOCAFLIX processa o pagamento via Pix e retém os valores até o check-in, protegendo ambas as partes. Após o check-in confirmado, o repasse ao anfitrião é realizado conforme política vigente.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-white mb-3">5. Condutas Proibidas</h2>
            <p>É proibido na plataforma:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
              <li>Publicar informações falsas ou enganosas sobre imóveis</li>
              <li>Realizar transações fora da plataforma para evitar taxas</li>
              <li>Usar a plataforma para atividades ilegais</li>
              <li>Assediar ou ameaçar outros usuários</li>
              <li>Criar múltiplas contas para burlar limitações</li>
              <li>Manipular avaliações de forma fraudulenta</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-white mb-3">6. Limitação de Responsabilidade</h2>
            <p>A LOCAFLIX não se responsabiliza por danos diretos ou indiretos decorrentes do uso da plataforma, cancelamentos por parte de anfitriões, condições dos imóveis ou disputas entre hóspedes e anfitriões. Nossa responsabilidade é limitada ao valor pago pela reserva específica em questão.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-white mb-3">7. Alterações nos Termos</h2>
            <p>Podemos atualizar estes Termos periodicamente. Notificaremos você por e-mail sobre mudanças significativas. O uso continuado da plataforma após a notificação representa aceitação dos novos termos.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-white mb-3">8. Lei Aplicável</h2>
            <p>Estes termos são regidos pelas leis brasileiras. Foro eleito: comarca de Itajaí — SC, com exclusão de qualquer outro.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-white mb-3">9. Contato</h2>
            <p>Dúvidas jurídicas sobre estes termos: <a href="mailto:suporte@locaflix.com.br" className="text-[#E50914] hover:underline">suporte@locaflix.com.br</a></p>
          </section>
        </div>
      </div>
    </div>
  )
}
