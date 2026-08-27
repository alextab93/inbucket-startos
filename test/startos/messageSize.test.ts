import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { storeShape } from '../../startos/fileModels/store.json'
import {
  inbucketEnvironment,
  mibToBytes,
} from '../../startos/inbucketEnvironment'

const validStore = {
  domain: 'mail.example.com',
  retentionPeriod: '1h' as const,
  mailboxMessageCap: 300,
  databasePassword: 'd'.repeat(32),
  secretKeyBase: 's'.repeat(64),
  adminUsername: 'admin',
  adminPassword: 'p'.repeat(16),
}

describe('maximum SMTP message size', () => {
  it('defaults missing and invalid stored values to 50 MiB', () => {
    assert.equal(storeShape.parse(validStore).maxMessageSizeMb, 50)
    assert.equal(
      storeShape.parse({ ...validStore, maxMessageSizeMb: 0 }).maxMessageSizeMb,
      50,
    )
    assert.equal(
      storeShape.parse({ ...validStore, maxMessageSizeMb: 101 })
        .maxMessageSizeMb,
      50,
    )
  })

  it('preserves a configured whole-number value within the allowed range', () => {
    assert.equal(
      storeShape.parse({ ...validStore, maxMessageSizeMb: 25 })
        .maxMessageSizeMb,
      25,
    )
  })

  it('converts MiB to bytes', () => {
    assert.equal(mibToBytes(50), 52_428_800)
    assert.equal(mibToBytes(25), 26_214_400)
  })

  it('provides the configured byte limit to Inbucket', () => {
    const env = inbucketEnvironment(
      { ...validStore, maxMessageSizeMb: 50 },
      { smtp: 2500, web: 9000, pop3: 1100 },
    )
    assert.equal(env.INBUCKET_SMTP_MAXMESSAGEBYTES, '52428800')

    const customEnv = inbucketEnvironment(
      { ...validStore, maxMessageSizeMb: 25 },
      { smtp: 2500, web: 9000, pop3: 1100 },
    )
    assert.equal(customEnv.INBUCKET_SMTP_MAXMESSAGEBYTES, '26214400')
  })
})
