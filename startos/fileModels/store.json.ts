import { FileHelper, z } from '@start9labs/start-sdk'
import { sdk } from '../sdk'

export const domainRegex =
  /^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/

export const storeShape = z
  .object({
    domain: z.string().regex(domainRegex).catch(''),
    retentionPeriod: z.enum(['15m', '1h', '6h', '24h', '168h']).catch('1h'),
    mailboxMessageCap: z.number().int().min(1).max(10000).catch(300),
    maxMessageSizeMb: z.number().int().min(1).max(100).catch(50),
    databasePassword: z.string().min(32).catch(''),
    secretKeyBase: z.string().min(64).catch(''),
    adminUsername: z.string().trim().min(1).default('admin'),
    adminPassword: z.string().min(16).catch(''),
  })
  .strip()

export const storeJson = FileHelper.json(
  { base: sdk.volumes.main, subpath: './store.json' },
  storeShape,
)
