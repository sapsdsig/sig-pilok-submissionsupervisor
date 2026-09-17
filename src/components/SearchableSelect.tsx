import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'

export type SearchableOption = { value: string; label: string }

type Props = {
  value: string
  options: readonly SearchableOption[]
  placeholder: string
  emptyMessage: string
  inputId: string
  ariaLabel: string
  fieldPath: string
  describedBy?: string
  loading?: boolean
  disabled?: boolean
  invalid?: boolean
  onChange: (value: string) => void
  onBlur?: () => void
}

export function SearchableSelect(props: Props) {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const selectedLabel =
    props.options.find((option) => option.value === props.value)?.label ??
    props.value

  useEffect(() => {
    setOpen(false)
    setQuery('')
  }, [props.value])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const filtered = useMemo(() => {
    const key = query.trim().toLocaleUpperCase('id-ID')
    return props.options.filter(
      (option) =>
        !key ||
        option.label.toLocaleUpperCase('id-ID').includes(key),
    )
  }, [props.options, query])

  const select = (option: SearchableOption) => {
    props.onChange(option.value)
    setOpen(false)
    setQuery('')
  }

  if (props.value && !open) {
    return (
      <button
        id={props.inputId}
        type='button'
        role='combobox'
        aria-label={props.ariaLabel}
        aria-controls={listId}
        aria-expanded='false'
        aria-invalid={props.invalid}
        aria-describedby={props.describedBy}
        aria-busy={props.loading}
        data-field-path={props.fieldPath}
        className={`searchable-select-control searchable-select-selected ${props.invalid ? 'input-error' : ''}`}
        disabled={props.disabled}
        onClick={() => {
          setQuery('')
          setActiveIndex(0)
          setOpen(true)
        }}
      >
        <span className='min-w-0 flex-1 truncate text-left' title={selectedLabel}>
          {selectedLabel}
        </span>
        <span className='shrink-0 text-slate-500' aria-hidden='true'>
          {props.loading ? '...' : '▾'}
        </span>
      </button>
    )
  }

  return (
    <div className='relative'>
      <div className='relative'>
        <input
          ref={inputRef}
          id={props.inputId}
          type='text'
          role='combobox'
          autoComplete='off'
          aria-label={props.ariaLabel}
          aria-autocomplete='list'
          aria-controls={listId}
          aria-expanded={open}
          aria-invalid={props.invalid}
          aria-describedby={props.describedBy}
          aria-busy={props.loading}
          data-field-path={props.fieldPath}
          className={`text-input truncate pr-10 ${props.invalid ? 'input-error' : ''}`}
          disabled={props.disabled}
          placeholder={props.loading ? 'Memuat data...' : props.placeholder}
          value={query}
          onBlur={() => {
            setOpen(false)
            setQuery('')
            props.onBlur?.()
          }}
          onFocus={() => {
            setOpen(true)
            setActiveIndex(0)
          }}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            setActiveIndex(0)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setActiveIndex((index) =>
                Math.min(index + 1, Math.max(filtered.length - 1, 0)),
              )
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActiveIndex((index) => Math.max(index - 1, 0))
            } else if (event.key === 'Enter' && filtered[activeIndex]) {
              event.preventDefault()
              select(filtered[activeIndex])
            } else if (event.key === 'Escape') {
              setOpen(false)
              setQuery('')
            }
          }}
        />
        <span
          className='pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500'
          aria-hidden='true'
        >
          {props.loading ? '...' : '▾'}
        </span>
      </div>

      {open && !props.disabled && (
        <div
          id={listId}
          role='listbox'
          className='absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl'
        >
          {filtered.length === 0 ? (
            <p className='px-3 py-2 text-sm text-slate-500'>
              {props.emptyMessage}
            </p>
          ) : (
            filtered.map((option, index) => (
              <button
                key={option.value}
                type='button'
                role='option'
                aria-selected={option.value === props.value}
                className={`block w-full truncate rounded-md px-3 py-2 text-left text-sm ${index === activeIndex ? 'bg-sky-50 text-sky-900' : 'text-slate-700 hover:bg-slate-50'}`}
                title={option.label}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault()
                  select(option)
                }}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
