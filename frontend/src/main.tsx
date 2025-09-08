import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
    <>
        {/* <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background/80" /> */}
        <App />
</>
)
