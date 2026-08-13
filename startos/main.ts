import { storeJson } from './fileModels/store.json'
import { i18n } from './i18n'
import { sdk } from './sdk'
import {
  clientPort,
  databaseName,
  databaseUser,
  mounts,
  pop3Port,
  smtpPort,
  webHostId,
  webPort,
} from './utils'

export const main = sdk.setupMain(async ({ effects }) => {
  const config = await storeJson.read((store) => store).const(effects)
  if (!config?.domain)
    throw new Error('Disposable mail domain is not configured')
  if (
    !config.databasePassword ||
    !config.secretKeyBase ||
    !config.adminUsername ||
    !config.adminPassword
  ) {
    throw new Error('Inbucket client secrets have not been initialized')
  }

  const inbucketAddress = await sdk.host
    .getBridgeAddress(effects, {
      packageId: 'inbucket',
      hostId: webHostId,
      internalPort: webPort,
      ssl: false,
    })
    .const()
  if (!inbucketAddress) throw new Error('Inbucket web host is not available')

  const clientEnv = {
    DATABASE_URL: `postgresql://${databaseUser}:${config.databasePassword}@127.0.0.1:5432/${databaseName}`,
    SECRET_KEY_BASE: config.secretKeyBase,
    RAILS_ENV: 'production',
    RAILS_LOG_TO_STDOUT: 'true',
    PORT: String(clientPort),
    INBUCKET_BASE_URL: `http://${inbucketAddress}`,
    ADMIN_USERNAME: config.adminUsername,
    ADMIN_PASSWORD: config.adminPassword,
  }

  const inbucketSubcontainer = sdk.SubContainer.of(
    effects,
    { imageId: 'main' },
    mounts,
    'inbucket',
  )

  const postgresSubcontainer = sdk.SubContainer.of(
    effects,
    { imageId: 'postgres' },
    sdk.Mounts.of().mountVolume({
      volumeId: 'client-postgres',
      subpath: null,
      mountpoint: '/var/lib/postgresql/data',
      readonly: false,
    }),
    'client-postgres',
  )

  const clientSubcontainer = sdk.SubContainer.of(
    effects,
    { imageId: 'client' },
    sdk.Mounts.of(),
    'client',
  )

  return sdk.Daemons.of(effects)
    .addDaemon('inbucket', {
      subcontainer: inbucketSubcontainer,
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
        display: 'Admin Web Interface',
        fn: () =>
          sdk.healthCheck.checkPortListening(effects, webPort, {
            successMessage: 'The admin web interface is ready',
            errorMessage: 'The admin web interface is not ready',
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
    .addDaemon('client-postgres', {
      subcontainer: postgresSubcontainer,
      exec: {
        command: sdk.useEntrypoint(['-c', 'listen_addresses=127.0.0.1']),
        env: {
          POSTGRES_DB: databaseName,
          POSTGRES_USER: databaseUser,
          POSTGRES_PASSWORD: config.databasePassword,
          PGDATA: '/var/lib/postgresql/data',
        },
      },
      ready: {
        display: 'Client Database',
        fn: () =>
          sdk.healthCheck.runHealthScript(
            [
              'pg_isready',
              '-h',
              '127.0.0.1',
              '-U',
              databaseUser,
              '-d',
              databaseName,
            ],
            postgresSubcontainer,
            {
              errorMessage: 'The client database is not ready',
              message: () => 'The client database is ready',
            },
          ),
      },
      requires: [],
    })
    .addOneshot('client-database-prepare', {
      subcontainer: clientSubcontainer,
      exec: { command: ['bin/rails', 'db:prepare'], env: clientEnv },
      requires: ['client-postgres'],
    })
    .addOneshot('client-account-prepare', {
      subcontainer: clientSubcontainer,
      exec: {
        command: [
          'bin/rails',
          'runner',
          'AdminAccount.sync!(username: ENV.fetch("ADMIN_USERNAME"), password: ENV.fetch("ADMIN_PASSWORD"))',
        ],
        env: clientEnv,
      },
      requires: ['client-database-prepare'],
    })
    .addDaemon('client-monitor', {
      subcontainer: clientSubcontainer,
      exec: {
        command: ['bin/rails', 'runner', 'InbucketMonitor.run'],
        env: clientEnv,
      },
      ready: {
        display: 'Client Monitor',
        fn: () =>
          sdk.healthCheck.runHealthScript(
            ['test', '-f', '/tmp/inbucket-monitor-ready'],
            clientSubcontainer,
            {
              errorMessage: 'The client monitor is not ready',
              message: () => 'The client monitor is ready',
            },
          ),
      },
      requires: ['client-account-prepare'],
    })
    .addDaemon('client', {
      subcontainer: clientSubcontainer,
      exec: {
        command: ['bundle', 'exec', 'puma', '-C', 'config/puma.rb'],
        env: clientEnv,
      },
      ready: {
        display: 'Web Client Interface',
        fn: () =>
          sdk.healthCheck.checkWebUrl(
            effects,
            `http://127.0.0.1:${clientPort}/up`,
            {
              successMessage: 'The web client interface is ready',
              errorMessage: 'The web client interface is not ready',
            },
          ),
      },
      requires: ['client-account-prepare'],
    })
})
