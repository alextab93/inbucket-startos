import { setupManifest } from '@start9labs/start-sdk'
import { long, short } from './i18n'

export const manifest = setupManifest({
  id: 'inbucket',
  title: 'Inbucket',
  license: 'MIT',
  packageRepo: 'https://github.com/alextab93/inbucket-startos',
  upstreamRepo: 'https://github.com/inbucket/inbucket',
  marketingUrl: 'https://www.inbucket.org/',
  donationUrl: null,
  description: { short, long },
  volumes: ['main'],
  images: {
    main: {
      source: {
        dockerTag:
          'inbucket/inbucket:3.1.1@sha256:4a4c4cf553967e1863e4f48c828774786ac9ee73c53b3a3ecef10f66e5a2cdfb',
      },
      arch: ['x86_64', 'aarch64'],
    },
  },
  dependencies: {},
})
