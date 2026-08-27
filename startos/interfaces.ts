import { i18n } from './i18n'
import { sdk } from './sdk'
import { clientHostId, clientPort, smtpPort, webHostId, webPort } from './utils'

export const setInterfaces = sdk.setupInterfaces(async ({ effects }) => {
  const webHost = sdk.MultiHost.of(effects, webHostId)
  const webOrigin = await webHost.bindPort(webPort, {
    protocol: 'http',
    preferredExternalPort: webPort,
  })

  const adminWebUi = sdk.createInterface(effects, {
    name: i18n('Admin Web Interface'),
    id: 'ui',
    description: i18n(
      'Upstream Inbucket webmail, server status, and diagnostics without mailbox authentication',
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

  const clientHost = sdk.MultiHost.of(effects, clientHostId)
  const clientOrigin = await clientHost.bindPort(clientPort, {
    protocol: 'http',
    preferredExternalPort: 80,
    addSsl: {
      alpn: { specified: ['http/1.1'] },
      preferredExternalPort: 443,
      addXForwardedHeaders: true,
      auth: null,
    },
  })

  const client = sdk.createInterface(effects, {
    name: i18n('Web Client Interface'),
    id: 'client',
    description: i18n(
      'Authenticated mailbox reading, monitoring, source viewing, CID images, and attachment downloads',
    ),
    type: 'ui',
    masked: false,
    schemeOverride: null,
    username: null,
    path: '/',
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
    await clientOrigin.export([client]),
    await webOrigin.export([adminWebUi, restApi]),
    await smtpOrigin.export([smtp]),
  ]
})
