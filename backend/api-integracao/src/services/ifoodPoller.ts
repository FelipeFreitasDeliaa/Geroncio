import { ifoodAdapter, type NotificacaoPedido } from '../adapters/ifood.adapter'

const MOCK_IFOOD_URL = process.env.MOCK_IFOOD_URL || 'http://localhost:3333'

type ProcessarNotificacaoFn = (
  plataforma: string,
  adapter: typeof ifoodAdapter,
  notificacao: NotificacaoPedido
) => Promise<void>

export async function iniciarPollerIFood(processarNotificacaoFn: ProcessarNotificacaoFn) {
  let executando = false

  setInterval(async () => {
    // Evita chamadas simultâneas se o ciclo anterior ainda estiver processando
    if (executando) return
    executando = true

    try {
      // 1. Busca eventos
      const res = await fetch(`${MOCK_IFOOD_URL}/order/v1.0/events:polling`)
      if (!res.ok) return

      const eventos = await res.json()
      if (!Array.isArray(eventos) || eventos.length === 0) return

      const notificacoes = ifoodAdapter.extrairNotificacoes(eventos)
      const ackList: { id: string }[] = []

      // 2. Processa cada pedido
      for (const notificacao of notificacoes) {
        try {
          if (notificacao.tipo === 'PLACED') {
            await processarNotificacaoFn('ifood', ifoodAdapter, notificacao)
          }
          ackList.push({ id: notificacao.eventoId })
        } catch (erroItem) {
          console.error(`[iFood Poller] Erro ao processar evento ${notificacao.eventoId}:`, erroItem)
        }
      }

      // 3. Envia ACK apenas para os eventos processados com sucesso
      if (ackList.length > 0) {
        await fetch(`${MOCK_IFOOD_URL}/order/v1.0/events/acknowledgment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ackList),
        })
      }
    } catch (err) {
      console.error('[iFood Poller] Erro de rede/polling:', err)
    } finally {
      executando = false
    }
  }, 5000)
}