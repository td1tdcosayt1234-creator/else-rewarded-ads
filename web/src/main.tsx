import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// App is served from two places:
//   https://elsepay.indevs.in/       (root = earn place)
//   https://elsepay.indevs.in/app    (legacy links / WebView)
// Router basename must match where it actually lives, otherwise routes won't match.
const path = window.location.pathname;
const isAppPath = path === '/app' || path.startsWith('/app/');
const basename = isAppPath ? '/app' : '';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
