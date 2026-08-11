import { i18n } from './i18n'
import { sdk } from './sdk'
import { storeJson } from './fileModels/store.json'
import { mounts, pop3Port, smtpPort, webPort } from './utils'

export const main = sdk.setupMain(async ({ effects }) => {
  const config = await storeJson.read((store) => store).const(effects)
  if (!config?.domain)
    throw new Error('Disposable mail domain is not configured')

  const subcontainer = sdk.SubContainer.of(
    effects,
    { imageId: 'main' },
    mounts,
    'inbucket',
  )

  return sdk.Daemons.of(effects)
    .addDaemon('inbucket', {
      subcontainer,
      exec: {
        command: sdk.useEntrypoint(),
        env: {
          INBUCKET_MAILBOXNAMING: 'local',
          INBUCKET_SMTP_ADDR: `0.0.0.0:${smtpPort}`,
          INBUCKET_SMTP_DOMAIN: config.domain,
          INBUCKET_SMTP_DEFAULTACCEPT: 'false',
          INBUCKET_SMTP_ACCEPTDOMAINS: config.domain,
          INBUCKET_SMTP_DEFAULTSTORE: 'false',
          INBUCKET_SMTP_STOREDOMAINS: config.domain,
          INBUCKET_SMTP_TIMEOUT: '30s',
          INBUCKET_WEB_ADDR: `0.0.0.0:${webPort}`,
          INBUCKET_POP3_ADDR: `127.0.0.1:${pop3Port}`,
          INBUCKET_STORAGE_TYPE: 'file',
          INBUCKET_STORAGE_PARAMS: 'path:/storage',
          INBUCKET_STORAGE_RETENTIONPERIOD: config.retentionPeriod,
          INBUCKET_STORAGE_MAILBOXMSGCAP: String(config.mailboxMessageCap),
        },
      },
      ready: {
        display: i18n('Web Interface'),
        fn: () =>
          sdk.healthCheck.checkPortListening(effects, webPort, {
            successMessage: i18n('The web interface is ready'),
            errorMessage: i18n('The web interface is not ready'),
          }),
      },
      requires: [],
    })
    .addHealthCheck('smtp', {
      ready: {
        display: i18n('Inbound SMTP'),
        fn: () =>
          sdk.healthCheck.checkPortListening(effects, smtpPort, {
            successMessage: i18n('The inbound SMTP listener is ready'),
            errorMessage: i18n('The inbound SMTP listener is not ready'),
          }),
      },
      requires: ['inbucket'],
    })
})
