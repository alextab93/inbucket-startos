import '../../css/base.css'
import '../../css/hero.css'
import '../../css/inbucket.css'
import { beforeEach, describe, expect, it } from 'vitest'

describe('authenticated header visibility', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <nav class="inbucket-tabs" hidden>
        <button class="inbucket-tab" type="button">Mailboxes</button>
      </nav>
      <button class="button button-secondary" type="button" hidden>Sign out</button>
    `
  })

  it('keeps authenticated controls out of the layout while signed out', () => {
    const navigation = document.querySelector('nav')
    const signOut = document.querySelector('.button')

    expect(getComputedStyle(navigation).display).toBe('none')
    expect(getComputedStyle(signOut).display).toBe('none')
  })
})
