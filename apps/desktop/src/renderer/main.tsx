import './platform'

import { flag } from '@session/app'
import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'

// Its own chunk, so a build with the flag off never loads the stories or the fake's showcase.
const Catalog = lazy(() => import('./catalog'))

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
