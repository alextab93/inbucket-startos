import { sdk } from '../sdk'
import { configureDomain } from './configureDomain'
import { configureSmtp } from './configureSmtp'
import { setAdminPassword } from './setAdminPassword'

export const actions = sdk.Actions.of()
  .addAction(configureDomain)
  .addAction(configureSmtp)
  .addAction(setAdminPassword)
