import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { store } from '@/store'
import { queryClient } from '@/lib/queryClient'
import { ThemeBoot } from '@/components/theme/ThemeBoot'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <TooltipProvider delayDuration={200}>
            <ThemeBoot />
            <App />
            <Toaster richColors position="top-right" closeButton />
          </TooltipProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  </StrictMode>,
)
