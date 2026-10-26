import './platform'

import { flag } from '@session/app'
import { setPageZoom } from '@session/ui'
import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'

// Its own chunk, so a build with the flag off never loads the stories or the fake's showcase.
const Catalog = lazy(() => import('./catalog'))

// Before the first render, so a saved zoom is how the page first draws rather than a jump after.
window.sessionDesktop.onZoom(setPageZoom)

const container = document.getElementById('root')
if (!container) throw new Error('index.html has no #root to render into')

createRoot(container).render(
  flag('componentCatalog') ? (
    <Suspense>
      <Catalog />
    </Suspense>
  ) : (
    <App />
  ),
)
