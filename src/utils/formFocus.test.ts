import { describe, expect, it, vi } from 'vitest'
import {
  focusFirstInvalidField,
  INVALID_FIELD_SELECTOR,
} from './formFocus'

function invalidTarget(fieldPath: string) {
  return {
    dataset: { fieldPath },
    scrollIntoView: vi.fn(),
    focus: vi.fn(),
  } as unknown as HTMLElement
}

describe('focusFirstInvalidField', () => {
  it('scrolls and focuses the first invalid control returned in DOM order', () => {
    const target = invalidTarget('wilayah.0.supervisors.1.namaSupervisor')
    const root = {
      querySelector: vi.fn(() => target),
    } as unknown as ParentNode

    const result = focusFirstInvalidField(root)

    expect(root.querySelector).toHaveBeenCalledWith(INVALID_FIELD_SELECTOR)
    expect(result?.dataset.fieldPath).toBe(
      'wilayah.0.supervisors.1.namaSupervisor',
    )
    expect(target.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    })
    expect(target.focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('does nothing when the form has no invalid control', () => {
    const root = {
      querySelector: vi.fn(() => null),
    } as unknown as ParentNode

    expect(focusFirstInvalidField(root)).toBeNull()
  })
})
