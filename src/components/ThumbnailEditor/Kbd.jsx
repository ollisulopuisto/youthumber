import { bindingKeys, getShortcut, isMacPlatform } from '../../modules/shortcuts/shortcuts'

/** One key cap. `small` for hints inside buttons and menus. */
function Kbd({ children, small = false }) {
  const size = small ? 'min-w-[1.1rem] h-[18px] px-1 text-[10px]' : 'min-w-[1.5rem] h-6 px-1.5 text-[11px]'
  return (
    <kbd
      className={`inline-flex items-center justify-center rounded border border-gray-600 border-b-2 bg-gray-800 text-gray-200 font-mono leading-none ${size}`}
    >
      {children}
    </kbd>
  )
}

/** The caps of a shortcut's first binding, e.g. ⌘ D. */
export function ShortcutKeys({ id, small = false }) {
  return bindingKeys(getShortcut(id).bindings[0], isMacPlatform()).map((key) => (
    <Kbd key={key} small={small}>
      {key}
    </Kbd>
  ))
}

export default Kbd
