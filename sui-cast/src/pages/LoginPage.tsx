// src/App.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ConnectButton,
  useCurrentAccount,
  useSuiClient,
  useSuiClientQuery,
} from '@mysten/dapp-kit';
import { motion, AnimatePresence } from 'framer-motion';
import { Chrome, Wallet, Moon, Sun, Sparkles, Lock, Shield } from 'lucide-react';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import {
  generateNonce,
  generateRandomness,
  jwtToAddress,
} from '@mysten/sui/zklogin';
import { jwtDecode } from 'jwt-decode';
import { useToast } from '../components/Toast';

// ---------- ENV ---------- //
const GOOGLE_CLIENT_ID = import.meta.env
  .VITE_GOOGLE_CLIENT_ID as string | undefined;
const REDIRECT_URL =
  (import.meta.env.VITE_ZKLOGIN_REDIRECT_URL as string | undefined) ??
  window.location.origin;

// ---------- JWT payload type ---------- //
type JwtPayload = {
  email?: string;
  sub?: string;
  name?: string;
  picture?: string;
  aud?: string | string[];
};

// ---------- Salt helpers ---------- //
function hashcode(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return BigInt(h >>> 0).toString();
}

function getSaltFromJwt(payload: JwtPayload): string {
  const base = payload.email ?? payload.sub ?? 'default-user';
  return hashcode(base);
}


// 🎨 Floating particles component
function FloatingParticles({ isDark }: { isDark: boolean }) {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    size: Math.random() * 4 + 2,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: Math.random() * 10 + 10,
    delay: Math.random() * 5,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className={`absolute rounded-full ${
            isDark ? 'bg-[#F25912]' : 'bg-[#A59D84]'
          }`}
          style={{
            width: particle.size,
            height: particle.size,
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            opacity: 0.2,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

type LoginPageProps = {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
};

function LoginPage({ theme, setTheme }: LoginPageProps) {
  const navigate = useNavigate();
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const { showToast } = useToast();

  const [zkLoading, setZkLoading] = useState(false);
  const [zkAddress, setZkAddress] = useState<string | null>(null);
  const [zkUserInfo, setZkUserInfo] = useState<{
    email?: string;
    name?: string;
    picture?: string;
  } | null>(null);
  const [zkStatus, setZkStatus] = useState<string | null>(null);

  const isDark = theme === 'dark';

  // 🚀 Auto-redirect when wallet is connected
  useEffect(() => {
    if (currentAccount) {
      // Wallet connected, clear logout flag
      localStorage.removeItem('wallet_logged_out');
      setTimeout(() => {
        navigate('/app');
      }, 1000);
    }
  }, [currentAccount, navigate]);

  // 🔁 Capture id_token from URL on return from Google
  useEffect(() => {

    // Google OAuth returns id_token in URL fragment (#), not in query string (?)
    // Example: http://localhost:5173/#id_token=xxx&authuser=0
    const hash = window.location.hash.substring(1); // Remove # character
    const hashParams = new URLSearchParams(hash);
    let idToken = hashParams.get('id_token');
    
    // Fallback: query string check
    if (!idToken) {
      const url = new URL(window.location.href);
      idToken = url.searchParams.get('id_token');
    }
    
    
    if (!idToken) return;

    // Clear URL (remove hash and query parameters)
    window.history.replaceState({}, '', window.location.pathname);

    let decoded: JwtPayload;
    try {
      decoded = jwtDecode<JwtPayload>(idToken);
    } catch (e) {
      console.error('JWT decode error:', e);
      setZkStatus('JWT could not be decoded.');
      return;
    }

    const salt = getSaltFromJwt(decoded);
    const address = jwtToAddress(idToken, salt);
    setZkAddress(address);
    setZkUserInfo({
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
    });
    
    // Save zkLogin info to sessionStorage (to be used in DocumentsPage)
    sessionStorage.setItem('zklogin_address', address);
    sessionStorage.setItem('zklogin_user_info', JSON.stringify({
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
    }));
    
    // Clear logout flag
    localStorage.removeItem('wallet_logged_out');
    
    setZkStatus('zkLogin session active. You can transact on Sui with this address.');
    
    // 💾 Save to localStorage
    localStorage.setItem('zkLoginAddress', address);
    localStorage.setItem('zkLoginUserInfo', JSON.stringify({
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
    }));
    
    // 🚀 Auto-redirect after zkLogin
    setTimeout(() => {
      navigate('/app');
    }, 2000);
  }, [navigate]);

  // 🔐 zkLogin button
  const handleZkLoginClick = async () => {
    if (!GOOGLE_CLIENT_ID) {
      showToast(
        'VITE_GOOGLE_CLIENT_ID is not defined. Please check .env file.',
        'error'
      );
      return;
    }

    try {
      setZkLoading(true);
      const { epoch } = await suiClient.getLatestSuiSystemState();
      const maxEpoch = Number(epoch) + 2;
      const ephemeralKeyPair = new Ed25519Keypair();
      const randomness = generateRandomness();
      const nonce = generateNonce(
        ephemeralKeyPair.getPublicKey(),
        maxEpoch,
        randomness,
      );

      sessionStorage.setItem(
        'zklogin_ephemeral_data',
        JSON.stringify({
          maxEpoch,
          randomness: randomness.toString(),
          ephemeralSecretKey: ephemeralKeyPair.getSecretKey(),
        }),
      );

      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: REDIRECT_URL,
        response_type: 'id_token',
        scope: 'openid email profile',
        nonce,
      });
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      window.location.href = authUrl;
    } catch (err) {
      console.error('Error starting zkLogin:', err);
      showToast('An error occurred while starting zkLogin. Check the console.', 'error');
      setZkLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen w-full font-sans transition-colors duration-300 flex flex-col relative overflow-hidden ${
        isDark ? 'text-slate-50' : 'text-slate-900'
      }`}
      style={isDark ? { backgroundColor: '#211832' } : { backgroundColor: '#ECEBDE' }}
    >
      {/* Animated gradient background blobs with rotation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, -100, 0],
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className={`absolute top-0 -left-20 w-96 h-96 rounded-full blur-3xl ${
            isDark ? 'opacity-25' : 'opacity-30'
          }`}
          style={isDark ? {
            background: 'radial-gradient(circle, #5C3E94, #F25912)'
          } : {
            background: 'radial-gradient(circle, #A59D84, #C1BAA1)'
          }}
        />
        <motion.div
          animate={{
            x: [0, -100, 0],
            y: [0, 100, 0],
            scale: [1, 1.1, 1],
            rotate: [0, -90, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className={`absolute bottom-0 -right-20 w-96 h-96 rounded-full blur-3xl ${
            isDark ? 'opacity-20' : 'opacity-25'
          }`}
          style={isDark ? {
            background: 'radial-gradient(circle, #412B6B, #F25912)'
          } : {
            background: 'radial-gradient(circle, #C1BAA1, #D7D3BF)'
          }}
        />
        <motion.div
          animate={{
            x: [0, 50, 0],
            y: [0, 50, 0],
            scale: [1, 1.3, 1],
            rotate: [0, 180, 0],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl ${
            isDark ? 'opacity-15' : 'opacity-20'
          }`}
          style={isDark ? {
            background: 'radial-gradient(circle, #5C3E94, #412B6B)'
          } : {
            background: 'radial-gradient(circle, #A59D84, #D7D3BF)'
          }}
        />
      </div>

      {/* 🎨 Floating particles */}
      <FloatingParticles isDark={isDark} />

      {/* 🔲 Grid pattern overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, ${isDark ? 'rgba(92, 62, 148, 0.1)' : 'rgba(165, 157, 132, 0.15)'} 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
          opacity: 0.3,
        }}
      />

      {/* 🌓 Toggle theme switcher */}
      <div className="flex justify-end p-4 relative z-10">
        <motion.button
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className={`relative w-16 h-8 rounded-full p-1 transition-colors duration: 300 backdrop-blur-sm border ${
            isDark ? 'border-[#5C3E94]/40' : 'border-[#A59D84]/40'
          }`}
          style={isDark 
            ? { backgroundColor: '#412B6B' } 
            : { backgroundColor: '#D7D3BF' }
          }
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <motion.div
            layout
            transition={{
              type: "spring",
              stiffness: 700,
              damping: 30
            }}
            className={`absolute top-1 w-6 h-6 rounded-full shadow-md flex items-center justify-center ${
              isDark ? 'left-9' : 'left-1'
            }`}
            style={isDark 
              ? { backgroundColor: '#5C3E94' } 
              : { background: 'linear-gradient(135deg, #A59D84 0%, #C1BAA1 100%)' }
            }
          >
            <AnimatePresence mode="wait">
              {isDark ? (
                <motion.div
                  key="moon"
                  initial={{ rotate: -180, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 180, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Moon className="w-3.5 h-3.5 text-white" />
                </motion.div>
              ) : (
                <motion.div
                  key="sun"
                  initial={{ rotate: 180, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -180, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Sun className="w-3.5 h-3.5 text-white" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          <div className="flex items-center justify-between h-full px-1.5">
            <Sun className={`w-3 h-3 transition-opacity ${isDark ? 'opacity-30' : 'opacity-50'}`} style={isDark ? { color: '#F25912' } : { color: '#A59D84' }} />
            <Moon className={`w-3 h-3 transition-opacity ${isDark ? 'opacity-50' : 'opacity-30'}`} style={isDark ? { color: '#F25912' } : { color: '#A59D84' }} />
          </div>
        </motion.button>
      </div>

      {/* Centered content with header */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-md space-y-6">
          {/* 💫 Header text with floating icons */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center space-y-3 relative"
          >
            {/* Floating Sparkles icon */}
            <motion.div
              animate={{
                y: [0, -10, 0],
                rotate: [0, 10, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute -left-8 top-0"
            >
              <Sparkles className={`w-6 h-6 ${isDark ? 'text-[#F25912]' : 'text-[#A59D84]'}`} />
            </motion.div>

            {/* Floating Shield icon */}
            <motion.div
              animate={{
                y: [0, -10, 0],
                rotate: [0, -10, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5,
              }}
              className="absolute -right-8 top-0"
            >
              <Shield className={`w-6 h-6 ${isDark ? 'text-[#5C3E94]' : 'text-[#C1BAA1]'}`} />
            </motion.div>

            <motion.h1 
              className="text-4xl font-bold tracking-tight"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={isDark ? 'dark-title' : 'light-title'}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    display: 'inline-block',
                    background: isDark 
                      ? 'linear-gradient(135deg, #F25912 0%, #5C3E94 100%)'
                      : 'linear-gradient(135deg, #A59D84 0%, #C1BAA1 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Sui-Cast
                </motion.span>
              </AnimatePresence>
            </motion.h1>
            <p className={`text-lg ${isDark ? 'text-slate-300' : 'text-[#A59D84] font-medium'}`}>
              Simple and secure sign-in on Sui.
            </p>

            {/* 🔒 Security badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm ${
                isDark 
                  ? 'bg-[#5C3E94]/20 text-[#F25912] border border-[#5C3E94]/30' 
                  : 'bg-[#A59D84]/20 text-[#A59D84] border border-[#A59D84]/30'
              }`}
            >
              <Lock className="w-3 h-3" />
              <span>Secured by zkLogin & Sui Network</span>
            </motion.div>
          </motion.div>

          {/* ✨ Login card with hover effects */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            whileHover={{ 
              y: -5,
              boxShadow: isDark 
                ? '0 30px 40px -10px rgba(92, 62, 148, 0.4), 0 15px 15px -5px rgba(242, 89, 18, 0.2)'
                : '0 30px 40px -10px rgba(165, 157, 132, 0.3), 0 15px 15px -5px rgba(193, 186, 161, 0.2)'
            }}
            className={`w-full rounded-2xl p-6 shadow-2xl space-y-5 border backdrop-blur-sm relative overflow-hidden ${
              !isDark ? 'border-[#C1BAA1]/40' : 'border-[#5C3E94]/30'
            }`}
            style={isDark ? {
              backgroundColor: '#412B6Bcc',
              boxShadow: '0 20px 25px -5px rgba(92, 62, 148, 0.3), 0 10px 10px -5px rgba(242, 89, 18, 0.1)'
            } : {
              backgroundColor: '#ECEBDE',
              boxShadow: '0 20px 25px -5px rgba(165, 157, 132, 0.2), 0 10px 10px -5px rgba(193, 186, 161, 0.15)'
            }}
          >
            {/* Animated border glow */}
            <motion.div
              className="absolute inset-0 rounded-2xl"
              animate={{
                background: isDark 
                  ? [
                      'radial-gradient(600px circle at var(--mouse-x, 0px) var(--mouse-y, 0px), rgba(242, 89, 18, 0.1), transparent 40%)',
                      'radial-gradient(600px circle at var(--mouse-x, 0px) var(--mouse-y, 0px), rgba(92, 62, 148, 0.1), transparent 40%)',
                    ]
                  : [
                      'radial-gradient(600px circle at var(--mouse-x, 0px) var(--mouse-y, 0px), rgba(165, 157, 132, 0.08), transparent 40%)',
                      'radial-gradient(600px circle at var(--mouse-x, 0px) var(--mouse-y, 0px), rgba(193, 186, 161, 0.08), transparent 40%)',
                    ]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatType: "reverse"
              }}
              style={{ pointerEvents: 'none' }}
            />

            {/* Title */}
            <div className="text-center space-y-1 relative z-10">
              <h2 className="text-2xl font-semibold">Sign in</h2>
              <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-[#A59D84]'}`}>
                Choose a sign-in method below.
              </p>
            </div>

            {/* Buttons */}
            <div className="space-y-4 relative z-10">
              {/* 🌈 zkLogin button with shine effect */}
              <motion.button
                onClick={handleZkLoginClick}
                disabled={zkLoading}
                whileHover={{ scale: zkLoading ? 1 : 1.02 }}
                whileTap={{ scale: zkLoading ? 1 : 0.98 }}
                className="w-full inline-flex items-center justify-center gap-3 rounded-xl py-3 px-4 text-sm font-medium transition-all disabled:opacity-70 disabled:cursor-not-allowed relative overflow-hidden group text-white shadow-lg"
                style={isDark ? {
                  background: 'linear-gradient(135deg, #F25912 0%, #5C3E94 100%)',
                  boxShadow: '0 10px 15px -3px rgba(242, 89, 18, 0.4)'
                } : {
                  background: 'linear-gradient(135deg, #A59D84 0%, #C1BAA1 100%)',
                  boxShadow: '0 10px 15px -3px rgba(165, 157, 132, 0.4)'
                }}
              >
                {/* Shine effect on hover */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  initial={{ x: '-100%' }}
                  whileHover={{ x: '100%' }}
                  transition={{ duration: 0.6 }}
                />

                <AnimatePresence mode="wait">
                  {zkLoading ? (
                    <motion.span
                      key="spinner"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="h-4 w-4 border-2 border-t-transparent rounded-full animate-spin border-white"
                    />
                  ) : (
                    <motion.div
                      key="icon"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                    >
                      <Chrome className="w-5 h-5 text-white" />
                    </motion.div>
                  )}
                </AnimatePresence>
                <span className="relative z-10">Continue with Google (zkLogin)</span>
              </motion.button>

              {/* Divider */}
              <div className={`flex items-center gap-3 text-[11px] ${isDark ? 'text-slate-400' : 'text-[#A59D84]'}`}>
                <div 
                  className="flex-1 h-px"
                  style={isDark ? { backgroundColor: '#5C3E9460' } : { backgroundColor: '#C1BAA160' }}
                />
                <span>or</span>
                <div 
                  className="flex-1 h-px"
                  style={isDark ? { backgroundColor: '#5C3E9460' } : { backgroundColor: '#C1BAA160' }}
                />
              </div>

              {/* 🎯 Wallet connect with micro-interaction */}
              <motion.div
                whileHover={{ scale: 1.01 }}
                className={`w-full flex flex-col gap-2 rounded-xl p-3 border transition-colors ${
                  !isDark ? 'border-[#C1BAA1]/40' : 'border-[#5C3E94]/40'
                }`}
                style={isDark ? { backgroundColor: '#211832' } : { backgroundColor: '#D7D3BF' }}
              >
                <div className={`flex items-center justify-between text-xs ${isDark ? 'text-slate-300' : 'text-[#A59D84]'}`}>
                  <span className="flex items-center gap-1">
                    <Wallet className="w-3 h-3" />
                    Wallet connect
                  </span>
                </div>
                <ConnectButton />
              </motion.div>
            </div>

            {/* zkLogin session info */}
            {zkAddress && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-4 space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-3 relative z-10"
              >
                <p className="text-xs font-medium text-emerald-300">
                  zkLogin session
                </p>
                {zkUserInfo && (
                  <div className="flex items-center gap-3">
                    {zkUserInfo.picture && (
                      <img
                        src={zkUserInfo.picture}
                        className="h-8 w-8 rounded-full border border-slate-700 object-cover"
                        alt={zkUserInfo.name ?? zkUserInfo.email ?? 'User'}
                      />
                    )}
                    <div className="text-xs">
                      <p className="text-slate-100">
                        {zkUserInfo.name ?? 'Signed in user'}
                      </p>
                      {zkUserInfo.email && (
                        <p className="text-slate-400">{zkUserInfo.email}</p>
                      )}
                    </div>
                  </div>
                )}
                <div className="text-[11px] mt-2">
                  <p className="text-slate-400 mb-1">Sui zkLogin address</p>
                  <p className="font-mono break-all text-emerald-300">
                    {zkAddress}
                  </p>
                </div>
                {zkStatus && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    {zkStatus}
                  </p>
                )}
              </motion.div>
            )}

            {/* Connected address + objects */}
            <div 
              className="pt-4 border-t space-y-3 relative z-10"
              style={isDark ? { borderColor: '#5C3E9440' } : { borderColor: '#C1BAA140' }}
            >
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
      <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-[#A59D84]'}`}>
        No wallet connected yet.
      </p>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3 text-xs"
    >
      <div>
        <p className={isDark ? 'text-slate-300 mb-1' : 'text-[#A59D84] mb-1'}>Connected address</p>
        <motion.div
          whileHover={{ scale: 1.01 }}
          className={`font-mono break-all rounded-md px-2 py-1 text-[11px] ${
            !isDark ? 'text-slate-900 border' : 'text-slate-100'
          }`}
          style={isDark 
            ? { backgroundColor: '#211832' } 
            : { backgroundColor: '#D7D3BF', borderColor: '#C1BAA1' }
          }
        >
          {account.address}
        </motion.div>
      </div>

      <OwnedObjects address={account.address} isDark={isDark} />
    </motion.div>
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`flex items-center gap-2 text-[11px] ${isDark ? 'text-slate-500' : 'text-[#A59D84]'}`}
      >
        <span 
          className="h-3 w-3 border-2 border-t-transparent rounded-full animate-spin"
          style={isDark ? { borderColor: '#F25912' } : { borderColor: '#A59D84' }}
        />
        Loading objects…
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-[11px] text-red-400"
      >
        Error: {(error as Error).message}
      </motion.p>
    );
  }

  const objects = data?.data ?? [];

  if (!objects.length) {
    return (
      <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-[#A59D84]'}`}>
        No objects found for this address.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <p className={`text-[11px] ${isDark ? 'text-slate-300' : 'text-[#A59D84]'}`}>
        Owned objects ({objects.length})
      </p>
      <ul className="max-h-24 overflow-auto space-y-1 scrollbar-thin">
        {objects.map((obj: any, index: number) => (
          <motion.li
            key={obj.data?.objectId ?? obj.objectId ?? index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.02, x: 5 }}
            transition={{ delay: index * 0.05 }}
            className={`font-mono text-[11px] break-all rounded px-2 py-1 cursor-default ${
              !isDark ? 'text-slate-900 border' : 'text-slate-100'
            }`}
            style={isDark 
              ? { backgroundColor: '#211832' } 
              : { backgroundColor: '#D7D3BF', borderColor: '#C1BAA1' }
            }
          >
            {obj.data?.objectId ?? obj.objectId}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

export default LoginPage;