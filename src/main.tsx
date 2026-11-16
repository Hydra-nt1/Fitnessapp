import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { HashRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { queryClient } from './lib/api'
import { App } from './App'
import './index.css'

registerSW({ immediate: true })

const persister = createSyncStoragePersister({ storage: window.localStorage, key: 'ft_cache' })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 14, buster: 'v2' }}>
      <HashRouter>
        <App />
      </HashRouter>
    </PersistQueryClientProvider>
  </StrictMode>,
)
