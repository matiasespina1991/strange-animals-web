import React from 'react';
import ReactDOM from 'react-dom/client';
import {App} from './App';
import './lib/firebase';
import {MediaProvider} from './media/react/MediaProvider';
import './styles/global.css';

ReactDOM.createRoot(document.querySelector('#root')!).render(
  <React.StrictMode>
    <MediaProvider>
      <App />
    </MediaProvider>
  </React.StrictMode>,
);
