import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

export const domainRegex =
  /^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/

const shape = z
  .object({
    domain: z.string().regex(domainRegex).catch(''),
  })
  .strip()

export const storeJson = FileHelper.json(
  { base: sdk.volumes.main, subpath: './store.json' },
  shape,
)
