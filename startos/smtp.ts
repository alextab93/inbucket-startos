import { type T } from '@start9labs/start-sdk'

export type SmtpEnvironmentInput = {
  host: string
  port: string
  username: string
  password: string | null | undefined
  from: string
  security: 'tls' | 'starttls'
}

export const toSmtpValue = (
  value: T.SmtpValue | null,
): SmtpEnvironmentInput | null => {
  if (!value) return null
  return {
    host: value.host,
    port: String(value.port),
    username: value.username,
    password: value.password,
    from: value.from,
    security: value.security,
  }
}

export const smtpEnvironment = (
  smtp: SmtpEnvironmentInput | null,
): Record<string, string> => {
  if (!smtp) return { OUTBOUND_SMTP_ENABLED: 'false' }
  return {
    OUTBOUND_SMTP_ENABLED: 'true',
    OUTBOUND_SMTP_HOST: smtp.host,
    OUTBOUND_SMTP_PORT: smtp.port,
    OUTBOUND_SMTP_USERNAME: smtp.username,
    OUTBOUND_SMTP_PASSWORD: smtp.password ?? '',
    OUTBOUND_SMTP_FROM: smtp.from,
    OUTBOUND_SMTP_SECURITY: smtp.security,
  }
}
