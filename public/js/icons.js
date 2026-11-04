import { raw } from './dom.js';

export const icon = (name, cls = '') =>
  raw(`<svg class="icon ${cls}" aria-hidden="true" focusable="false"><use href="/icons/sprite.svg#i-${name}"></use></svg>`);
