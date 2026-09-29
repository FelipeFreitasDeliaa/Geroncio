import app from './server'
import { iniciarPollerIFood } from './services/ifoodPoller'
import { processarNotificacao } from './routes'

const PORT = Number(process.env.PORT) || 3005

app.listen(PORT, () => {
  console.log(`API DE INTEGRAÇÃO RODANDO NA PORTA ${PORT}`)

  // Inicia o polling do iFood passando a função oficial que busca o pedido e grava no banco
  iniciarPollerIFood(processarNotificacao as any)
})