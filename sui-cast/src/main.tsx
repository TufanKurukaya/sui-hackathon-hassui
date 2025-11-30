// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';

import '@mysten/dapp-kit/dist/index.css';
import './index.css';
import { BrowserRouter } from 'react-router-dom';

import {
  createNetworkConfig,
  SuiClientProvider,
  WalletProvider,
  lightTheme,
} from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import App from './App';
import { darkTheme } from './theme';

const { networkConfig } = createNetworkConfig({
  devnet: { url: getFullnodeUrl('devnet') },
  testnet: { url: getFullnodeUrl('testnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
});

const queryClient = new QueryClient();

// If user has not manually logged out, autoConnect should be active
const shouldAutoConnect = localStorage.getItem('wallet_logged_out') !== 'true';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider
          autoConnect={shouldAutoConnect}
          theme={[
            // Default: light (if 'dark' class is not present in html/body)
            { variables: lightTheme },
            // If html/body has '.dark' class: darkTheme
            {
              selector: '.dark',
              variables: darkTheme,
            },
          ]}
        >
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
