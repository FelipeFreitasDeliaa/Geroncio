import type { IncomingMessage, ServerResponse } from "node:http";
import { PrismaClient } from "../../src/generated/prisma/client.ts";

export async function tratarRequisicaoIFood(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  metodo: string,
  prisma: PrismaClient
): Promise<boolean> {
  // 1. POLLING DE EVENTOS: GET /order/v1.0/events:polling
  if (metodo === "GET" && pathname === "/order/v1.0/events:polling") {
    const eventos = await prisma.evento.findMany({
      where: { plataforma: "IFOOD", canal: "POLLING", ackEm: null },
      take: 50,
      orderBy: { criadoEm: "asc" },
    });

    const respostaIFood = eventos.map((e) => ({
      id: e.id,
      code: e.tipo,
      fullCode: e.tipo,
      orderId: (e.payload as any)?.pedidoId,
      createdAt: e.criadoEm.toISOString(),
    }));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(respostaIFood));
    return true;
  }

  // 2. ACK DE EVENTOS: POST /order/v1.0/events/acknowledgment
  if (metodo === "POST" && pathname === "/order/v1.0/events/acknowledgment") {
    const partes: Buffer[] = [];
    for await (const parte of req) partes.push(parte as Buffer);
    const corpo = partes.length > 0 ? JSON.parse(Buffer.concat(partes).toString()) : [];

    const ids: string[] = corpo.map((item: any) => item.id);
    if (ids.length > 0) {
      await prisma.evento.updateMany({
        where: { id: { in: ids } },
        data: { ackEm: new Date() },
      });
    }

    res.writeHead(200);
    res.end();
    return true;
  }

  // 3. DETALHES DO PEDIDO: GET /order/v1.0/orders/:id
  const matchDetalhes = pathname.match(/^\/order\/v1\.0\/orders\/([^\/]+)$/);
  if (metodo === "GET" && matchDetalhes) {
    const idExterno = matchDetalhes[1];
    const pedido = await prisma.pedido.findFirst({
      where: { plataforma: "IFOOD", idExterno },
    });

    if (!pedido) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Pedido não encontrado" }));
      return true;
    }

    // Estrutura simplificada no padrão iFood Open Platform
    const payloadIFood = {
      id: pedido.idExterno,
      displayId: pedido.codigoExibicao,
      createdAt: pedido.criadoEm.toISOString(),
      orderType: pedido.tipo,
      customer: pedido.cliente,
      delivery: {
        deliveryAddress: pedido.endereco,
      },
      items: (pedido.itens as any[]).map((item) => ({
        id: item.codigoExterno,
        name: item.nome,
        quantity: item.quantidade,
        unitPrice: item.precoUnitarioCentavos / 100,
        totalPrice: (item.quantidade * item.precoUnitarioCentavos) / 100,
      })),
      total: {
        subTotal: pedido.subtotalCentavos / 100,
        deliveryFee: pedido.taxaEntregaCentavos / 100,
        benefits: (pedido.descontoPlataformaCentavos + pedido.descontoLojaCentavos) / 100,
        orderAmount: pedido.totalCentavos / 100,
      },
      payments: pedido.pagamento,
    };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payloadIFood));
    return true;
  }

  return false;
}