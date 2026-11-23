import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './arena.css'
import { ArenaApp } from './ArenaApp'

// Results change when an organiser saves one, so data is treated as fresh for
// a short while rather than forever.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ArenaApp />
    </QueryClientProvider>
  </StrictMode>,
)
