import { useEffect, useState } from 'react'

const STATUS_MESSAGES = [
  'We are processing your request…',
  'Generating files…',
  'Installing dependencies…',
  'Starting your preview…',
  'Almost there…',
]

const ROTATE_MS = 2800

export function ProcessingLoader() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % STATUS_MESSAGES.length)
    }, ROTATE_MS)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="loader" role="status" aria-live="polite">
      <div className="loader__orbits" aria-hidden>
        <span className="loader__ring" />
        <span className="loader__ring loader__ring--delay" />
        <span className="loader__core" />
      </div>
      <p className="loader__message" key={index}>
        {STATUS_MESSAGES[index]}
      </p>
      <p className="loader__hint">This can take a minute for a new project</p>
    </div>
  )
}
