// src/App.tsx
import { useEffect, useState } from 'react';
import {
  ConnectButton,
  useCurrentAccount,
  useSuiClientQuery,
} from '@mysten/dapp-kit';
import { motion } from 'framer-motion';
import { Chrome, Wallet } from 'lucide-react';

function App() {
  return <LoginPage />;
}

function LoginPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    // İlk yüklemede sistem temasına bak (isteğe bağlı)
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  const [zkLoading, setZkLoading] = useState(false);
  const account = useCurrentAccount();

  // Tailwind + dApp Kit için ortak 'dark' class'ı
  useEffect(() => {
    const root = document.documentElement; // <html>
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const handleZkLoginClick = () => {
    setZkLoading(true);
    setTimeout(() => {
      console.log('zkLogin button clicked – plug your real flow here.');
      setZkLoading(false);
      alert('zkLogin integration is not wired yet. This is a placeholder for your real flow.');
    }, 1200);
  };

  const isDark = theme === 'dark';

  return (
    <div
      className={`min-h-screen w-full font-sans transition-colors ${
        isDark ? 'bg-slate-950 text-slate-50' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Tema switcher - sağ üst */}
      <div className="flex justify-end p-4">
        <div className="flex items-center gap-2 text-[11px]">
          <button
            className={`px-2 py-1 rounded-md border text-xs ${
              !isDark
                ? 'border-slate-300 bg-slate-100 text-slate-900'
                : 'border-slate-600 bg-transparent text-slate-400'
            }`}
            onClick={() => setTheme('light')}
          >
            Light
          </button>
          <button
            className={`px-2 py-1 rounded-md border text-xs ${
              isDark
                ? 'border-slate-300 bg-slate-900 text-slate-100'
                : 'border-slate-400 bg-transparent text-slate-500'
            }`}
            onClick={() => setTheme('dark')}
          >
            Dark
          </button>
        </div>
      </div>

      <div className="flex">
        {/* LEFT: logo + short description */}
<div
  className={
    `hidden lg:flex w-1/2 flex-col justify-between p-10 relative ` +
    (isDark
      ? 'bg-gradient-to-br from-indigo-950 via-slate-950 to-black'
      : 'bg-gradient-to-br from-slate-100 via-white to-slate-200')
  }
>
          <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_top,_#4f46e5_0,_transparent_55%)]" />

          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold">
                42
              </div>
              <span className="text-lg font-semibold tracking-wide">
                Pedagogy dApp
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl font-bold">
                <span>Simple and secure sign-in</span> <br />
                <span className="text-indigo-400">on Sui.</span>
              </h1>
              <p className="text-sm text-slate-300 max-w-md">
                Choose: a normal wallet or zkLogin (Google). Everything in one clean screen.
              </p>
            </div>
          </div>

          <div className="relative z-10 text-xs text-slate-400">
            Built on Sui • Tailwind + dApp Kit Dynamic Theme
          </div>
        </div>

        {/* RIGHT: login card + connected account */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={`w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-5 border ${
              isDark
                ? 'bg-slate-900/80 border-slate-800'
                : 'bg-white border-slate-200'
            }`}
          >
            {/* Title */}
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-semibold">Sign in</h2>
              <p className="text-xs text-slate-400">
                Choose a sign-in method below.
              </p>
            </div>

            {/* Buttons */}
            <div className="space-y-4">
              {/* zkLogin (Google) */}
              <button
                onClick={handleZkLoginClick}
                disabled={zkLoading}
                className="w-full inline-flex items-center justify-center gap-3 rounded-xl bg-white text-slate-900 py-3 px-4 text-sm font-medium hover:bg-slate-100 transition disabled:opacity-70"
              >
                {zkLoading ? (
                  <span className="h-4 w-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Chrome className="w-5 h-5 text-indigo-600" />
                )}
                <span>Continue with Google (zkLogin)</span>
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                <div className="flex-1 h-px bg-slate-700/60" />
                <span>or</span>
                <div className="flex-1 h-px bg-slate-700/60" />
              </div>

              {/* Normal wallet */}
              <div
                className={`w-full flex flex-col gap-2 rounded-xl p-3 border ${
                  isDark
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Wallet className="w-3 h-3" />
                    Wallet connect
                  </span>
                  <span className="uppercase tracking-wide text-[10px] text-slate-500">
                    dApp Kit
                  </span>
                </div>
                <ConnectButton />
              </div>
            </div>

            {/* Connected address + objects */}
            <div className="pt-4 border-t border-slate-800/60 space-y-3">
              <ConnectedAccountSection isDark={isDark} />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function ConnectedAccountSection({ isDark }: { isDark: boolean }) {
  const account = useCurrentAccount();

  if (!account) {
    return (
      <p className="text-xs text-slate-500">
        No wallet connected yet.
      </p>
    );
  }

  return (
    <div className="space-y-3 text-xs">
      <div>
        <p className="text-slate-400 mb-1">Connected address</p>
<div
  className={
    `font-mono break-all rounded-md px-2 py-1 text-[11px] ` +
    (isDark
      ? 'bg-slate-950 text-slate-100'
      : 'bg-slate-100 text-slate-900 border border-slate-200')
  }
>
  {account.address}
</div>
      </div>

      <OwnedObjects address={account.address} isDark={isDark} />
    </div>
  );
}

type OwnedObjectsProps = {
  address: string;
  isDark: boolean;
};

function OwnedObjects({ address, isDark }: OwnedObjectsProps) {
  const { data, isPending, error } = useSuiClientQuery('getOwnedObjects', {
    owner: address,
  });

  if (isPending) {
    return (
      <p className="text-slate-500 text-[11px]">
        Loading objects…
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-[11px] text-red-400">
        Error: {(error as Error).message}
      </p>
    );
  }

  const objects = data?.data ?? [];

  if (!objects.length) {
    return (
      <p className="text-[11px] text-slate-500">
        No objects found for this address.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-slate-400 text-[11px]">
        Owned objects ({objects.length})
      </p>
      <ul className="max-h-24 overflow-auto space-y-1">
        {objects.map((obj: any) => (
          <li
            className={
              `font-mono text-[11px] break-all rounded px-2 py-1 ` +
              (isDark
                ? 'bg-slate-950 text-slate-100'
                : 'bg-slate-100 text-slate-900 border border-slate-200')
            }
          >
            {obj.data?.objectId ?? obj.objectId}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
