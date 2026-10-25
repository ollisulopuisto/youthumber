/** One key cap. */
function Kbd({ children }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded border border-gray-600 border-b-2 bg-gray-800 text-gray-200 font-mono text-[11px] leading-none">
      {children}
    </kbd>
  )
}

export default Kbd
