import { i18n } from './i18n'
import { sdk } from './sdk'
import { smtpPort, webPort } from './utils'

export const setInterfaces = sdk.setupInterfaces(async ({ effects }) => {
  const webHost = sdk.MultiHost.of(effects, 'web')
  const webOrigin = await webHost.bindPort(webPort, {
    protocol: 'http',
    preferredExternalPort: webPort,
  })

  const webUi = sdk.createInterface(effects, {
    name: i18n('Web Interface'),
    id: 'ui',
    description: i18n(
      'Browse disposable mailboxes and inspect received messages',
    ),
    type: 'ui',
    masked: false,
    schemeOverride: null,
    username: null,
    path: '',
    query: {},
  })

  const restApi = sdk.createInterface(effects, {
    name: i18n('REST API'),
    id: 'rest-api',
    description: i18n('Programmatic access to Inbucket mailboxes and messages'),
    type: 'api',
    masked: false,
    schemeOverride: null,
    username: null,
    path: '/api/v1/',
    query: {},
  })

  const smtpHost = sdk.MultiHost.of(effects, 'smtp')
  const smtpOrigin = await smtpHost.bindPort(smtpPort, {
    protocol: null,
    addSsl: null,
    preferredExternalPort: smtpPort,
    secure: { ssl: false },
  })

  const smtp = sdk.createInterface(effects, {
    name: i18n('Inbound SMTP'),
    id: 'smtp',
    description: i18n(
      'Receive messages for the configured disposable mail domain',
    ),
    type: 'api',
    masked: false,
    schemeOverride: { ssl: null, noSsl: 'smtp' },
    username: null,
    path: '',
    query: {},
  })

  return [
    await webOrigin.export([webUi, restApi]),
    await smtpOrigin.export([smtp]),
  ]
})
