export const INVALID_FIELD_SELECTOR =
  '[data-field-path][aria-invalid=true]'

export function focusFirstInvalidField(
  root: ParentNode,
): HTMLElement | null {
  const target = root.querySelector<HTMLElement>(INVALID_FIELD_SELECTOR)
  if (!target) return null

  target.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  })
  target.focus({ preventScroll: true })
  return target
}
