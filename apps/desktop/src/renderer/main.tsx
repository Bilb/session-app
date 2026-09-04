import './platform'

import { createRoot } from 'react-dom/client'

import { App } from './App'

const container = document.getElementById('root')
if (!container) throw new Error('index.html has no #root to render into')

createRoot(container).render(<App />)
