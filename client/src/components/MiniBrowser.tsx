import { useState } from 'react'
import { ProcessingLoader } from './ProcessingLoader'

interface MiniBrowserProps {
  projectUrl: string | null
  isPending: boolean
  hasMessages: boolean
}

export function MiniBrowser({
  projectUrl,
  isPending,
  hasMessages,
}: MiniBrowserProps) {
  const [iframeKey, setIframeKey] = useState(0)
  const [iframeError, setIframeError] = useState(false)

  function refresh() {
    setIframeError(false)
    setIframeKey((k) => k + 1)
  }

  const showPreview = Boolean(projectUrl) && !isPending

  return (
    <section className="browser">
      <header className="browser__chrome">
        <div className="browser__traffic" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <div className="browser__address">
          <span className="browser__lock" aria-hidden />
          <input
            readOnly
            value={projectUrl ?? 'Preview will appear here'}
            className="browser__url"
            aria-label="Preview URL"
          />
        </div>
        <div className="browser__actions">
          {projectUrl && (
            <>
              <button
                type="button"
                className="browser__btn"
                onClick={refresh}
                disabled={isPending}
                title="Refresh preview"
              >
                Refresh
              </button>
              <a
                className="browser__btn browser__btn--link"
                href={projectUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open
              </a>
            </>
          )}
        </div>
      </header>

      <div className="browser__viewport">
        {isPending && !projectUrl && (
          <div className="browser__overlay">
            <ProcessingLoader />
          </div>
        )}

        {isPending && projectUrl && (
          <div className="browser__overlay browser__overlay--dim">
            <ProcessingLoader />
          </div>
        )}

        {!projectUrl && !isPending && (
          <div className="browser__empty">
            <div className="browser__empty-frame" aria-hidden />
            <p>
              {hasMessages
                ? 'Waiting for a preview URL from the server…'
                : 'Your live preview opens here once the project is ready.'}
            </p>
          </div>
        )}

        {showPreview && (
          <>
            {iframeError && (
              <div className="browser__empty">
                <p>
                  Preview could not load. The sandbox may still be starting — try
                  Refresh.
                </p>
                <button type="button" className="browser__btn" onClick={refresh}>
                  Retry
                </button>
              </div>
            )}
            <iframe
              key={iframeKey}
              src={projectUrl!}
              title="Project preview"
              className="browser__iframe"
              onLoad={() => setIframeError(false)}
              onError={() => setIframeError(true)}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />
          </>
        )}
      </div>
    </section>
  )
}
