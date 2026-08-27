import { beforeEach, describe, expect, it } from 'vitest'
import { configureMailboxTools } from './mailbox-tools'

const setupDocument = () => {
  document.body.innerHTML = `
    <details class="mailbox-tool">
      <summary>Add mailbox</summary>
      <form><input aria-label="Mailbox name"></form>
    </details>
    <details class="mailbox-tool">
      <summary>Manage mailboxes</summary>
      <section><button type="button">Select all</button></section>
    </details>
    <div id="message-panel"></div>
  `
  configureMailboxTools()
}

describe('mailbox tools', () => {
  beforeEach(setupDocument)

  it('closes an open tool when the user clicks outside it', () => {
    const tool = document.querySelector('.mailbox-tool')
    tool.open = true

    document.querySelector('#message-panel').click()

    expect(tool.open).toBe(false)
  })

  it('keeps an open tool visible when the user clicks inside it', () => {
    const tool = document.querySelector('.mailbox-tool')
    tool.open = true

    tool.querySelector('input').click()

    expect(tool.open).toBe(true)
  })

  it('closes an open tool with Escape and returns focus to its summary', () => {
    const tool = document.querySelector('.mailbox-tool')
    tool.open = true
    tool.querySelector('input').focus()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(tool.open).toBe(false)
    expect(document.activeElement).toBe(tool.querySelector('summary'))
  })
})
