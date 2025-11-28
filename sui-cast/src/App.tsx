// src/App.tsx
import { ConnectButton } from '@mysten/dapp-kit';

function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center p-1">
      <header className="w-full max-w-2xl flex justify-between items-center mb-10">
        <h1 className="text-xl font-semibold">Welcome to Suicast</h1>
        <ConnectButton />
      </header>
    </div>
  );
}

export default App;
