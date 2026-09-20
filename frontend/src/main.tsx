import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity, // Prevent automatic refetching on navigation
      refetchOnWindowFocus: false, // Prevent refetching when tab is focused
    },
  },
})

// Automatically recover when a deployment invalidates lazy-loaded chunk hashes
window.addEventListener('vite:preloadError', () => {
  const retryKey = 'sffl_vite_preload_retry';
  const lastAttempt = sessionStorage.getItem(retryKey);
  const now = Date.now();
  if (!lastAttempt || now - parseInt(lastAttempt, 10) > 10000) {
    sessionStorage.setItem(retryKey, String(now));
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
