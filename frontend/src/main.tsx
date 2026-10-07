import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { reloadForNewBuild } from './utils'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity, // Prevent automatic refetching on navigation
      refetchOnWindowFocus: false, // Prevent refetching when tab is focused
    },
  },
})

// Automatically recover when a deployment invalidates lazy-loaded chunk hashes.
// The error still reaches ErrorBoundary, which shows the loader while this
// reload is pending (see utils/staleBuild.ts).
window.addEventListener('vite:preloadError', () => {
  reloadForNewBuild();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
