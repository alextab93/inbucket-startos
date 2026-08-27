import { setupManifest } from '@start9labs/start-sdk'
import { long, short } from './i18n'

export const manifest = setupManifest({
  id: 'inbucket',
  title: 'Inbucket',
  license: 'MIT',
  packageRepo: 'https://github.com/Start9-Community/inbucket-startos',
  upstreamRepo: 'https://github.com/inbucket/inbucket',
  marketingUrl: 'https://www.inbucket.org/',
  donationUrl: null,
  description: { short, long },
  volumes: ['main', 'client-postgres'],
  images: {
    main: {
      source: {
        dockerTag:
          'inbucket/inbucket:3.1.1@sha256:4a4c4cf553967e1863e4f48c828774786ac9ee73c53b3a3ecef10f66e5a2cdfb',
      },
      arch: ['x86_64', 'aarch64'],
    },
    client: {
      source: { dockerBuild: {} },
      arch: ['x86_64', 'aarch64'],
    },
    postgres: {
      source: {
        dockerTag:
          'postgres:17.6-alpine@sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94',
      },
      arch: ['x86_64', 'aarch64'],
    },
  },
  dependencies: {},
})
