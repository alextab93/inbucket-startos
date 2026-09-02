export type InbucketEnvironmentConfig = {
  domain: string
  retentionPeriod: '15m' | '1h' | '6h' | '24h' | '168h' | '0'
  mailboxMessageCap: number
  maxMessageSizeMb: number
}

export const mibToBytes = (mib: number) => mib * 1024 * 1024

export const inbucketEnvironment = (
  config: InbucketEnvironmentConfig,
  ports: { smtp: number; web: number; pop3: number },
) => ({
  INBUCKET_MAILBOXNAMING: 'local',
  INBUCKET_SMTP_ADDR: `0.0.0.0:${ports.smtp}`,
  INBUCKET_SMTP_DOMAIN: config.domain,
  INBUCKET_SMTP_MAXMESSAGEBYTES: String(mibToBytes(config.maxMessageSizeMb)),
  INBUCKET_SMTP_DEFAULTACCEPT: 'false',
  INBUCKET_SMTP_ACCEPTDOMAINS: config.domain,
  INBUCKET_SMTP_DEFAULTSTORE: 'false',
  INBUCKET_SMTP_STOREDOMAINS: config.domain,
  INBUCKET_SMTP_TIMEOUT: '30s',
  INBUCKET_WEB_ADDR: `0.0.0.0:${ports.web}`,
  INBUCKET_POP3_ADDR: `127.0.0.1:${ports.pop3}`,
  INBUCKET_STORAGE_TYPE: 'file',
  INBUCKET_STORAGE_PARAMS: 'path:/storage',
  INBUCKET_STORAGE_RETENTIONPERIOD: config.retentionPeriod,
  INBUCKET_STORAGE_MAILBOXMSGCAP: String(config.mailboxMessageCap),
})
