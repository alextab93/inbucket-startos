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
  webPort,
} from './utils'

// The SDK's runHealthScript and checkWebUrl log the command, its result and an
// Error on every failed poll, which buries a normal startup in its own log.
// A probe that fails because it cannot run at all still has to be visible, so
// the first failure of each check reports why and the rest stay quiet.
const probe = (
  subcontainer: {
    exec: (
      command: string[],
    ) => Promise<{ exitCode: number | null; stderr: string | Buffer }>
  },
  command: string[],
  ready: string,
  notReady: string,
) => {
  let reported = false
  return async () => {
    const { exitCode, stderr } = await subcontainer.exec(command)
    if (exitCode === 0) return { result: 'success' as const, message: ready }
    if (!reported) {
      reported = true
      console.warn(
        `${command[0]} exited ${exitCode}: ${stderr.toString().trim()}`,
      )
    }
    return { result: 'failure' as const, message: notReady }
  }
}

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

  const clientEnv = {
    DATABASE_URL: `postgresql://${databaseUser}:${config.databasePassword}@127.0.0.1:5432/${databaseName}`,
    SECRET_KEY_BASE: config.secretKeyBase,
    RAILS_ENV: 'production',
    RAILS_LOG_TO_STDOUT: 'true',
    PORT: String(clientPort),
    INBUCKET_BASE_URL: `http://127.0.0.1:${webPort}`,
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
    'client-app',
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
        display: i18n('Admin Web Interface'),
        gracePeriod: 60000,
        fn: () =>
          sdk.healthCheck.checkPortListening(effects, webPort, {
            successMessage: i18n('The admin web interface is ready'),
            errorMessage: i18n('The admin web interface is not ready'),
          }),
      },
      requires: [],
    })
    .addHealthCheck('smtp', {
      ready: {
        display: i18n('Inbound SMTP'),
        gracePeriod: 60000,
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
        display: i18n('Client Database'),
        gracePeriod: 60000,
        fn: probe(
          postgresSubcontainer,
          [
            'pg_isready',
            '-h',
            '127.0.0.1',
            '-U',
            databaseUser,
            '-d',
            databaseName,
          ],
          i18n('The client database is ready'),
          i18n('The client database is not ready'),
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
        display: i18n('Client Monitor'),
        gracePeriod: 120000,
        fn: probe(
          clientSubcontainer,
          ['test', '-f', '/tmp/inbucket-monitor-ready'],
          i18n('The client monitor is ready'),
          i18n('The client monitor is not ready'),
        ),
      },
      requires: ['client-account-prepare'],
    })
    .addDaemon('client-reconciler', {
      subcontainer: clientSubcontainer,
      exec: {
        command: ['bin/rails', 'runner', 'InbucketReconciler.new.run'],
        env: clientEnv,
      },
      ready: {
        display: i18n('Client Reconciler'),
        gracePeriod: 120000,
        fn: probe(
          clientSubcontainer,
          ['test', '-f', '/tmp/inbucket-reconciler-ready'],
          i18n('The client reconciler is ready'),
          i18n('The client reconciler is not ready'),
        ),
      },
      requires: ['inbucket', 'client-account-prepare'],
    })
    .addDaemon('client', {
      subcontainer: clientSubcontainer,
      exec: {
        command: ['bundle', 'exec', 'puma', '-C', 'config/puma.rb'],
        env: clientEnv,
      },
      ready: {
        display: i18n('Web Client Interface'),
        gracePeriod: 120000,
        fn: probe(
          clientSubcontainer,
          // busybox wget: the client image is ruby-alpine and has no curl
          [
            'wget',
            '-q',
            '-O',
            '/dev/null',
            `http://127.0.0.1:${clientPort}/up`,
          ],
          i18n('The web client interface is ready'),
          i18n('The web client interface is not ready'),
        ),
      },
      requires: ['client-account-prepare'],
    })
})
