import { sdk } from '../sdk'
import { configureDomain } from './configureDomain'
import { setAdminPassword } from './setAdminPassword'

export const actions = sdk.Actions.of()
  .addAction(configureDomain)
  .addAction(setAdminPassword)
