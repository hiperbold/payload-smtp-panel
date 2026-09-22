import type { Field, GlobalConfig } from 'payload'
import { buildPasswordField } from './fields/passwordField.js'
import type { SmtpPanelPluginOptions } from './types.js'

export type BuildEmailSettingsGlobalArgs = SmtpPanelPluginOptions & {
  encryptionKey: string
}

export function buildEmailSettingsGlobal(options: BuildEmailSettingsGlobalArgs): GlobalConfig {
  const slug = options.slug ?? 'email-settings'
  const group = options.group ?? 'Settings'
  const defaults = options.defaults ?? {}
  const showTestButton = options.testEndpoint !== false
  const showBcc = options.defaultBcc === true

  const senderFields: Field[] = [
    {
      name: 'fromName',
      type: 'text',
      label: { en: 'Sender name', pt: 'Nome do remetente' },
      defaultValue: defaults.fromName,
      admin: {
        description: { en: 'Name shown as the sender. E.g.: Acme', pt: 'Nome que aparece como remetente. Ex.: Acme' },
      },
    },
    {
      name: 'fromEmail',
      type: 'email',
      label: { en: 'Sender email (From)', pt: 'E-mail do remetente (From)' },
      defaultValue: defaults.fromEmail,
      admin: {
        description: { en: 'E.g.: no-reply@example.com', pt: 'Ex.: no-reply@example.com' },
      },
    },
    {
      name: 'replyTo',
      type: 'email',
      label: { en: 'Reply-To', pt: 'Responder para (Reply-To)' },
      admin: {
        description: {
          en: 'Optional. Where replies to sent emails go.',
          pt: 'Opcional. Para onde vão as respostas dos e-mails enviados.',
        },
      },
    },
    {
      name: 'defaultTo',
      type: 'email',
      label: { en: 'Default recipient', pt: 'Destinatário padrão' },
      admin: {
        description: {
          en: 'Used when sendEmail is called without a "to" address.',
          pt: 'Usado quando sendEmail é chamado sem um endereço "to".',
        },
      },
    },
  ]

  if (showBcc) {
    senderFields.push({
      name: 'bcc',
      type: 'email',
      label: { en: 'Bcc', pt: 'Cópia oculta (Bcc)' },
      admin: {
        description: {
          en: 'Optional. Receives a blind copy of every email sent, unless skipDefaultBcc is used or it matches the recipient.',
          pt: 'Opcional. Recebe uma cópia oculta de todo e-mail enviado, salvo quando skipDefaultBcc é usado ou é igual ao destinatário.',
        },
      },
    })
  }

  const connectionFields: Field[] = [
    {
      name: 'host',
      type: 'text',
      label: { en: 'SMTP host', pt: 'Servidor SMTP (Host)' },
      admin: {
        description: { en: 'E.g.: smtp.example.com', pt: 'Ex.: smtp.example.com' },
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'port',
          type: 'number',
          label: { en: 'Port', pt: 'Porta' },
          defaultValue: defaults.port ?? 465,
          admin: {
            width: '50%',
            description: { en: '465 (SSL) · 587 (TLS) · 25 (none)', pt: '465 (SSL) · 587 (TLS) · 25 (sem criptografia)' },
          },
        },
        {
          name: 'encryption',
          type: 'select',
          label: { en: 'Encryption', pt: 'Criptografia' },
          defaultValue: defaults.encryption ?? 'ssl',
          admin: { width: '50%' },
          options: [
            { label: { en: 'SSL (port 465)', pt: 'SSL (porta 465)' }, value: 'ssl' },
            { label: { en: 'TLS / STARTTLS (port 587)', pt: 'TLS / STARTTLS (porta 587)' }, value: 'tls' },
            { label: { en: 'None', pt: 'Nenhuma' }, value: 'none' },
          ],
        },
      ],
    },
    {
      name: 'authEnabled',
      type: 'checkbox',
      label: { en: 'Use authentication', pt: 'Usar autenticação' },
      defaultValue: true,
    },
    {
      name: 'user',
      type: 'text',
      label: { en: 'Username', pt: 'Usuário (login)' },
      admin: {
        description: { en: 'Usually the full email address.', pt: 'Geralmente o e-mail completo.' },
        condition: (data) => data?.authEnabled !== false,
      },
    },
    buildPasswordField({ slug, encryptionKey: options.encryptionKey }),
  ]

  const testFields: Field[] = [
    {
      name: 'testTo',
      type: 'email',
      label: { en: 'Send test email to', pt: 'Enviar e-mail de teste para' },
      admin: {
        description: {
          en: 'Enter an address and click the button below to validate the configuration.',
          pt: 'Informe um endereço e clique no botão abaixo para validar a configuração.',
        },
      },
    },
  ]

  if (showTestButton) {
    testFields.push({
      name: 'testButton',
      type: 'ui',
      admin: {
        components: {
          Field: {
            path: '@hiperbold/payload-smtp-panel/client#TestEmailButton',
            clientProps: { slug },
          },
        },
      },
    })
  }

  return {
    slug,
    label: 'SMTP',
    admin: { group },
    access: {
      read: options.access.read,
      update: options.access.update,
    },
    fields: [
      {
        name: 'enabled',
        type: 'checkbox',
        label: { en: 'Enable email sending', pt: 'Ativar envio de e-mail' },
        defaultValue: true,
        admin: {
          description: {
            en: 'When off, emails are only logged on the server (safe/test mode).',
            pt: 'Se desligado, os e-mails são apenas registrados no log do servidor (modo seguro/teste).',
          },
        },
      },
      {
        type: 'tabs',
        tabs: [
          { label: { en: 'Sender', pt: 'Remetente' }, fields: senderFields },
          { label: { en: 'Connection', pt: 'Conexão' }, fields: connectionFields },
          { label: { en: 'Test', pt: 'Teste' }, fields: testFields },
        ],
      },
    ],
  }
}
