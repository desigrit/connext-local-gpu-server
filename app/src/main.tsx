import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/manrope';
import './styles.css';
import App from './App';

const compareBars = import.meta.env.DEV && new URLSearchParams(location.search).get('bars') === 'compare';
const GpuBarOptions = React.lazy(() => import('./GpuBarOptions'));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{compareBars ? <React.Suspense fallback={<p className="preview-loading">Loading options…</p>}><GpuBarOptions /></React.Suspense> : <App />}</React.StrictMode>,
);
