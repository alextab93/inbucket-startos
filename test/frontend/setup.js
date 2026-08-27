import { JSDOM } from 'jsdom'

globalThis.DOMParser = class {
  parseFromString(html, mimeType) {
    return new JSDOM(html, { contentType: mimeType }).window.document
  }
}
