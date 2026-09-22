# @hiperbold/payload-smtp-panel

Configuração de envio de e-mail para o Payload 3, editável pelo painel administrativo, com segredo cifrado, SMTP tradicional e transportes por API HTTPS.

## Por que existe

O adaptador de e-mail nativo do Payload é configurado em código e em variável de ambiente. Ele atende os e-mails do núcleo (recuperação de senha, verificação de e-mail) e só muda com um novo deploy. Este plugin adiciona um global no painel administrativo onde o cliente pode trocar o destinatário, o remetente ou o provedor de e-mail sem publicar o site de novo.

## Instalação

```bash
pnpm add @hiperbold/payload-smtp-panel
```

```bash
npm install @hiperbold/payload-smtp-panel
```

Exemplo mínimo de `payload.config.ts`:

```ts
import { buildConfig } from 'payload'
import { smtpPanelPlugin } from '@hiperbold/payload-smtp-panel'

export default buildConfig({
  plugins: [
    smtpPanelPlugin({
      access: {
        // Só administradores: quem edita esta tela decide para onde vão os e-mails.
        read: ({ req: { user } }) => Boolean(user?.roles?.includes('admin')),
        update: ({ req: { user } }) => Boolean(user?.roles?.includes('admin')),
      },
    }),
  ],
})
```

`access` é obrigatório no tipo, de propósito. Quem consegue editar essa tela decide para onde vão os e-mails do site. Não existe um padrão: é preciso definir explicitamente.

## Uso

Chame `sendEmail` em uma rota de formulário ou em qualquer código do servidor que precise enviar e-mail:

```ts
import { sendEmail } from '@hiperbold/payload-smtp-panel'

const result = await sendEmail(payload, {
  to: 'user@example.com',
  subject: 'Nova mensagem',
  text: 'Alguém enviou o formulário de contato.',
})

if (!result.ok) {
  payload.logger.error(result.error)
}
```

Contrato de retorno:

```ts
{ ok: true, messageId: string, skipped?: 'disabled' } | { ok: false, error: string }
```

`sendEmail` nunca lança exceção. Se o global de configurações de e-mail estiver com `enabled: false` ou sem `host`, ele registra no logger e devolve `{ ok: true, messageId: 'logged-only', skipped: 'disabled' }`. Se não houver destinatário nenhum, devolve `{ ok: false, error }`. Um envio de formulário nunca deve quebrar porque o envio de e-mail falhou.

## Opções do plugin

| Opção | Tipo | Padrão | Para que serve |
| --- | --- | --- | --- |
| `access` | `{ read, update }` | nenhum, obrigatório | Access control do Payload para o global de configurações de e-mail. É obrigatório porque essa tela controla para onde vão os e-mails do site. |
| `slug` | `string` | `'email-settings'` | Slug do global criado pelo plugin. |
| `group` | `string` | `'Settings'` | Grupo em que o global aparece no painel administrativo. |
| `defaults` | `Partial<EmailConfig>` | nenhum | Valores iniciais para campos como `fromName`, `port`, `encryption`. |
| `transports` | `Transport[]` | nenhum | Transportes próprios, testados na ordem informada, antes do transporte nodemailer padrão. |
| `encryptionKey` | `string` | `payload.secret` | Chave usada para derivar a chave AES-256-GCM que cifra o campo `pass`. |
| `defaultBcc` | `boolean` | `false` | Acrescenta um campo `bcc` no painel, aplicado a todo envio. |
| `testEndpoint` | `boolean` | `true` | Ativa a rota de teste e o botão de teste no painel. |
| `useAsPayloadEmailAdapter` | `boolean` | `false` | Liga essa configuração ao adaptador `email` do próprio Payload, para os e-mails do núcleo. |

## Transportes

Três transportes já vêm prontos com o plugin:

- **`nodemailerTransport()`**: o padrão de reserva. `matches` sempre retorna verdadeiro, por isso é usado por último. Usa `secure: true` na porta 465, `requireTLS: true` quando `encryption === 'tls'`, e só autentica quando `authEnabled` e `user` estão definidos.
- **`sendkitTransport()`**: combina quando o `host` é `sendkit.dev` ou um subdomínio dele. Envia um `POST` para `https://api.sendkit.dev/emails` com `Authorization: Bearer <pass>`.
- **`resendTransport()`**: combina quando o `host` é `resend.com` ou um subdomínio dele. Envia um `POST` para `https://api.resend.com/emails`, com o mesmo formato geral do SendKit.

O transporte é escolhido casando o `host` configurado com a função `matches` de cada transporte, na ordem informada na opção `transports`, mais o transporte nodemailer padrão no fim. Os transportes por HTTP compartilham um helper `postJsonWithRetry`: timeout de 15 segundos por tentativa, até 3 tentativas com esperas de 0, 1s e 3s, repetindo apenas em erro de rede, 429 e 5xx. Respostas 4xx não são repetidas.

Exemplo de transporte próprio:

```ts
import type { Transport } from '@hiperbold/payload-smtp-panel'

// Combina com um provedor fictício pelo host e envia para a API dele.
// config.pass chega já decifrado nesta chamada.
const exampleTransport: Transport = {
  name: 'example-provider',
  matches: (config) => Boolean(config.host?.endsWith('example.com')),
  send: async (config, message, ctx) => {
    const response = await ctx.fetch('https://api.example.com/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.pass}` },
      body: JSON.stringify(message),
    })
    const data = await response.json()
    return { messageId: data.id }
  },
}
```

## Segurança

- O campo `pass` é cifrado com AES-256-GCM antes de ser gravado. A chave é derivada de `encryptionKey` (padrão `payload.secret`) com scrypt. O formato guardado é `pspv1:<iv>:<tag>:<ciphertext>`, em base64.
- O campo sempre chega mascarado na leitura: `afterRead` devolve `''` a menos que o contexto da requisição tenha `decryptSecrets: true`. O `sendEmail` lê o global com esse contexto internamente.
- `access` é obrigatório e controla tanto a leitura quanto a atualização desse global. Não existe access control padrão.
- Se você trocar `encryptionKey`, os segredos já cifrados não podem mais ser decifrados com a chave nova. Será preciso redigitar o campo de senha no painel depois da troca.

## Armadilhas de produção

**Um segredo mascarado no `afterRead` chega vazio no `originalDoc`.** Manter a senha antiga quando o campo é enviado vazio pelo painel exige ler o valor cru do banco, e não de `originalDoc`, porque `originalDoc` já passou pelo `afterRead` e está mascarado. Usar `originalDoc` aqui apaga a senha guardada a cada Salvar. Esse bug exato aconteceu em produção e é o principal motivo deste pacote ter um teste de regressão próprio para ele.

**Muitos provedores de VPS bloqueiam a saída nas portas 25, 465, 587 e 2525.** O sintoma é um timeout antes mesmo de a autenticação começar, não um erro de autenticação. Para conferir de dentro do servidor: `nc -zv -w 5 host 465`. Essa é a razão de o plugin também trazer transportes por API HTTPS: eles usam a porta 443, raramente bloqueada.

**Os e-mails do próprio núcleo do Payload (recuperação de senha, verificação de e-mail) só saem por este plugin se `useAsPayloadEmailAdapter` estiver ligado**, ou se outro adaptador de e-mail estiver configurado. Sem um dos dois, o "esqueci minha senha" do painel administrativo não envia nada.

## Testes e desenvolvimento

```bash
pnpm install
pnpm test
pnpm build
pnpm typecheck
```

## Licença

MIT. Veja [LICENSE](./LICENSE).
