export function Privacy() {
  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl font-bold text-white mb-2">Privacidade e LGPD</h1>
        <p className="text-xs text-[#555] mb-8">Última atualização: janeiro de 2025</p>

        <div className="space-y-8 text-[#B3B3B3] text-sm leading-relaxed">
          <section>
            <h2 className="font-display text-lg font-bold text-white mb-3">1. Dados que coletamos</h2>
            <p>A LOCAFLIX coleta os seguintes dados pessoais:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
              <li><strong className="text-white">Cadastro:</strong> nome completo, e-mail, CPF, data de nascimento e telefone</li>
              <li><strong className="text-white">Verificação KYC:</strong> documento de identidade e selfie para anfitriões</li>
              <li><strong className="text-white">Pagamento:</strong> dados bancários para repasse (anfitriões) e histórico de transações</li>
              <li><strong className="text-white">Uso da plataforma:</strong> histórico de buscas, reservas, mensagens e avaliações</li>
              <li><strong className="text-white">Técnicos:</strong> endereço IP, tipo de dispositivo, navegador e cookies de sessão</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-white mb-3">2. Finalidade do tratamento</h2>
            <p>Seus dados são utilizados para:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
              <li>Autenticar e gerenciar sua conta na plataforma</li>
              <li>Processar reservas e pagamentos</li>
              <li>Verificar identidade e prevenir fraudes (KYC)</li>
              <li>Enviar comunicações sobre reservas e conta</li>
              <li>Cumprir obrigações legais e fiscais</li>
              <li>Melhorar a experiência na plataforma</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-white mb-3">3. Base legal (LGPD)</h2>
            <p>O tratamento dos seus dados é realizado com base nos seguintes fundamentos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018):</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
              <li>Execução de contrato (Art. 7º, V)</li>
              <li>Cumprimento de obrigação legal ou regulatória (Art. 7º, II)</li>
              <li>Legítimo interesse (Art. 7º, IX) para melhoria de serviços e prevenção de fraudes</li>
              <li>Consentimento para comunicações de marketing (Art. 7º, I)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-white mb-3">4. Seus direitos</h2>
            <p>Como titular de dados, você tem direito a:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
              <li>Confirmar a existência de tratamento e acessar seus dados</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados</li>
              <li>Solicitar anonimização, bloqueio ou eliminação de dados desnecessários</li>
              <li>Portabilidade dos seus dados para outro fornecedor</li>
              <li>Revogar consentimento para tratamento baseado em consentimento</li>
              <li>Solicitar a eliminação dos seus dados (sujeito a obrigações legais)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-white mb-3">5. Compartilhamento de dados</h2>
            <p>Seus dados podem ser compartilhados com:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
              <li>Anfitriões e hóspedes envolvidos em uma reserva (dados mínimos necessários)</li>
              <li>Processadores de pagamento parceiros (dados de transação)</li>
              <li>Autoridades legais, quando exigido por lei</li>
            </ul>
            <p className="mt-2">Não vendemos seus dados pessoais a terceiros.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-white mb-3">6. Segurança</h2>
            <p>Utilizamos criptografia em trânsito (TLS) e em repouso para proteger seus dados. Senhas são armazenadas com hash seguro e nunca em texto simples. O acesso aos dados é restrito por controle de permissões.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-white mb-3">7. Contato com o DPO</h2>
            <p>Para exercer seus direitos ou esclarecer dúvidas sobre privacidade, entre em contato com nosso Encarregado de Dados (DPO) pelo e-mail <a href="mailto:privacidade@locaflix.com.br" className="text-[#E50914] hover:underline">privacidade@locaflix.com.br</a>.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
