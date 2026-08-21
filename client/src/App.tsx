import { ChatPanel } from './components/ChatPanel'
import { MiniBrowser } from './components/MiniBrowser'
import { useChatSession } from './hooks/useChatSession'

export default function App() {
  const { session, isPending, error, sendMessage, clearSession } =
    useChatSession()

  return (
    <div className="app">
      <ChatPanel
        messages={session.messages}
        isPending={isPending}
        error={error}
        projectId={session.projectId}
        onSend={sendMessage}
        onClear={clearSession}
      />
      <MiniBrowser
        projectUrl={session.projectUrl}
        isPending={isPending}
        hasMessages={session.messages.length > 0}
      />
    </div>
  )
}
