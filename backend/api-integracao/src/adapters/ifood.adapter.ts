import type { Request } from 'express'

const MOCK_IFOOD_URL = process.env.MOCK_IFOOD_URL || 'http://localhost:3333'

export interface NotificacaoPedido {
  eventoId: string
  pedidoIdExterno: string
  lojaIdExterno?: string
  tipo: string
}

export interface ItemExterno {
  idExterno: string
  quantidade: number
}

export interface PedidoConvertido {
  nomeCliente: string | null
  preco: number
  metodoPagamento: string
  enderecoDestino: string
  cepDestino: string
  latitude: number | null
  longitude: number | null
  itens: ItemExterno[]
}

export const ifoodAdapter = {
  validarAssinatura(_req: Request): boolean {
    return true
  },

  extrairNotificacoes(corpo: any): NotificacaoPedido[] {
    if (!Array.isArray(corpo)) return []
    return corpo.map((evt) => ({
      eventoId: evt.id,
      pedidoIdExterno: evt.orderId,
      tipo: evt.code,
    }))
  },

  async buscarPedido(notificacao: NotificacaoPedido): Promise<unknown> {
    const res = await fetch(`${MOCK_IFOOD_URL}/order/v1.0/orders/${notificacao.pedidoIdExterno}`)
    if (!res.ok) throw new Error(`Erro ao buscar pedido iFood: ${res.statusText}`)
    return res.json()
  },

  converterPedido(pedidoExterno: any): PedidoConvertido {
    const cliente = pedidoExterno.customer?.nome || pedidoExterno.customer?.name || 'Cliente iFood'
    const endereco = pedidoExterno.delivery?.deliveryAddress
    const enderecoTexto = endereco?.rua ? `${endereco.rua}, ${endereco.numero ?? 'S/N'}` : 'Retirada na Loja'

    return {
      nomeCliente: cliente,
      preco: pedidoExterno.total?.orderAmount ?? 0,
      metodoPagamento: pedidoExterno.payments?.metodo || 'ONLINE',
      enderecoDestino: enderecoTexto,
      cepDestino: endereco?.cep || '00000-000',
      latitude: endereco?.latitude ?? null,
      longitude: endereco?.longitude ?? null,
      itens: (pedidoExterno.items || []).map((item: any) => ({
        idExterno: item.id,
        quantidade: item.quantity,
      })),
    }
  },
}