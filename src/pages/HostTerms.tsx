export function HostTerms() {
  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl font-bold text-white mb-2">Termos para Anfitriões</h1>
        <p className="text-xs text-[#555] mb-8">Última atualização: janeiro de 2025</p>

        <div className="space-y-8 text-[#B3B3B3] text-sm leading-relaxed">
          <section>
            <h2 className="font-display text-lg font-bold text-white mb-3">1. Elegibilidade</h2>
            <p>Para anunciar imóveis na LOCAFLIX, você deve:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
              <li>Ser maior de 18 anos e possuir plena capacidade civil</li>
              <li>Ser o proprietário do imóvel ou ter autorização expressa do proprietário</li>
              <li>Possuir documentação válida do imóvel (escritura, contrato de locação ou similar)</li>
              <li>Completar o processo de verificação KYC da plataforma</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-white mb-3">2. Responsabilidades do Anfitrião</h2>
            <p>Ao cadastrar um imóvel, você se compromete a:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
              <li>Fornecer informações precisas e atualizadas sobre o imóvel</li>
              <li>Manter o imóvel em condições compatíveis com as fotos e descrição publicadas</li>
              <li>Honrar todas as reservas confirmadas pela plataforma</li>
              <li>Responder mensagens de hóspedes em até 24 horas</li>
              <li>Cumprir a política de cancelamento selecionada</li>
              <li>Manter o imóvel limpo e seguro para os hóspedes</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-white mb-3">3. Taxas e Repasses</h2>
            <p>A LOCAFLIX cobra uma taxa de serviço sobre cada reserva confirmada. O valor exato é exibido no momento do cadastro do imóvel e pode ser consultado no painel do anfitrião. Os repasses são realizados após o check-in do hóspede, conforme política vigente da plataforma.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-white mb-3">4. Política de Cancelamento</h2>
            <p>Você deve escolher uma das políticas de cancelamento disponíveis (Flexível, Moderada ou Firme) ao cadastrar o imóvel. Esta política define as condições de reembolso ao hóspede em caso de cancelamento.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-white mb-3">5. Sinistros e Danos</h2>
            <p>Em caso de danos causados por hóspedes, você deve registrar um sinistro na plataforma em até 48h após o check-out, com fotos e descrição detalhada. A LOCAFLIX avaliará o caso e mediará a solução entre as partes.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-white mb-3">6. Suspensão e Encerramento</h2>
            <p>A LOCAFLIX reserva o direito de suspender ou remover anúncios que violem estes termos, apresentem informações falsas, acumulem avaliações negativas recorrentes ou cuja propriedade seja questionada judicialmente.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-white mb-3">7. Contato</h2>
            <p>Dúvidas sobre estes termos podem ser enviadas para <a href="mailto:suporte@locaflix.com.br" className="text-[#E50914] hover:underline">suporte@locaflix.com.br</a>.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
