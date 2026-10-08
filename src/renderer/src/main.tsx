import '@fontsource-variable/funnel-sans'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { loadStore } from './lib/store'
import './styles.css'

loadStore().then(() => createRoot(document.getElementById('root')!).render(<App />))
