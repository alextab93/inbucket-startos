import { sdk } from '../sdk'
import { configureDomain } from './configureDomain'

export const actions = sdk.Actions.of().addAction(configureDomain)
