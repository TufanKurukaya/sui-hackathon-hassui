/* src/components/ZkLoginCard.tsx */
import React, { useEffect, useState } from 'react';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import {
  generateNonce,
  generateRandomness,
  jwtToAddress,
  getExtendedEphemeralPublicKey,
  type ZkLoginSignatureInputs,
} from '@mysten/sui/zklogin';
import { jwtDecode } from 'jwt-decode';
import { useToast } from './Toast';

// -------------------- ENV & CONSTANTS -------------------- //
const FULLNODE_URL =
  import.meta.env.VITE_SUI_RPC_URL ?? getFullnodeUrl('testnet');

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const REDIRECT_URL =
  import.meta.env.VITE_ZKLOGIN_REDIRECT_URL ?? window.location.origin;
const PROVER_URL =
  import.meta.env.VITE_ZK_PROVER_URL ?? 'https://prover-dev.mystenlabs.com/v1';

const client = new SuiClient({ url: FULLNODE_URL });

// SessionStorage keys
const SESSION_JWT_KEY = 'sui_jwt_token';
const SESSION_ZKLOGIN_DATA_KEY = 'zklogin_ephemeral_data';

// Keeping JWT payload type simple
type JwtPayload = {
  email?: string;
  sub?: string;
  aud?: string | string[];
};

// Data to store during login
type StoredZkLoginData = {
  maxEpoch: number;
  randomness: string; // BigInt string
  ephemeralSecretKey: string; // Bech32 secret key (suiprivkey...)
};

// Partial signature type returned from Prover
type PartialZkLoginSignatureInputs = Omit<
  ZkLoginSignatureInputs,
  'addressSeed'
>;

// -------------------- SMALL HELPER FUNCTIONS -------------------- //

// Simple string -> number hash (like in the tutorial)
function hashcode(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return BigInt(h >>> 0).toString();
}

// Generate salt from JWT (using email / sub for demo)
function getSaltFromJwt(payload: JwtPayload): string {
  const base = payload.email ?? payload.sub ?? 'default-user';
  return hashcode(base);
}

// Function redirecting to Google OAuth
async function startGoogleLogin(onError: (message: string) => void) {
  if (!GOOGLE_CLIENT_ID) {
    onError('VITE_GOOGLE_CLIENT_ID is not defined!');
    return;
  }

  const { epoch } = await client.getLatestSuiSystemState();
  const maxEpoch = Number(epoch) + 2;

  const ephemeralKeyPair = Ed25519Keypair.generate();
  const randomness = generateRandomness();
  const randomnessStr = randomness.toString();

  const nonce = generateNonce(
    ephemeralKeyPair.getPublicKey(),
    maxEpoch,
    randomness,
  );

  const data: StoredZkLoginData = {
    maxEpoch,
    randomness: randomnessStr,
    ephemeralSecretKey: ephemeralKeyPair.getSecretKey(),
  };
  sessionStorage.setItem(SESSION_ZKLOGIN_DATA_KEY, JSON.stringify(data));

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URL,
    response_type: 'id_token',
    scope: 'openid email profile',
    nonce,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  window.location.href = authUrl;
}

// Function sending request to ZK prover
async function requestZkProof(opts: {
  jwt: string;
  salt: string;
  maxEpoch: number;
  randomness: string;
  ephemeralSecretKey: string;
}): Promise<PartialZkLoginSignatureInputs> {
  const keypair = Ed25519Keypair.fromSecretKey(opts.ephemeralSecretKey);

  const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(
    keypair.getPublicKey(),
  );

  const body = {
    jwt: opts.jwt,
    extendedEphemeralPublicKey: extendedEphemeralPublicKey.toString(),
    maxEpoch: opts.maxEpoch.toString(),
    jwtRandomness: opts.randomness,
    salt: opts.salt,
    keyClaimName: 'sub',
  };

  const res = await fetch(PROVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Prover error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as PartialZkLoginSignatureInputs;
  return data;
}

// -------------------- COMPONENT -------------------- //

const ZkLoginCard: React.FC = () => {
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    // Debug: Log all URL info


    // Google OAuth returns id_token in URL fragment (#), not in query string (?)
    // Example: https://site.com/#id_token=xxx&authuser=0
    const hash = window.location.hash.substring(1); // Remove # sign
    
    const hashParams = new URLSearchParams(hash);
    const idToken = hashParams.get('id_token');

    // Check if ephemeral data exists in session storage
    const existingZkData = sessionStorage.getItem(SESSION_ZKLOGIN_DATA_KEY);

    if (!idToken) {
      // Maybe it came in query string (in some configurations)
      const url = new URL(window.location.href);
      const queryToken = url.searchParams.get('id_token');
      
      if (!queryToken) {
        return;
      }
      // If came from query string, use it
      processToken(queryToken);
      return;
    }

    // Clear hash
    window.history.replaceState({}, '', window.location.pathname + window.location.search);

    processToken(idToken);
  }, []);

  const processToken = (idToken: string) => {
    
    sessionStorage.setItem(SESSION_JWT_KEY, idToken);

    let decoded: JwtPayload;
    try {
      decoded = jwtDecode<JwtPayload>(idToken);
    } catch (e) {
      console.error('JWT decode error:', e);
      setStatus('JWT could not be decoded.');
      return;
    }

    const stored = sessionStorage.getItem(SESSION_ZKLOGIN_DATA_KEY);
    if (!stored) {
      setStatus('Ephemeral key not found. Please log in again.');
      return;
    }

    const zkData: StoredZkLoginData = JSON.parse(stored);

    const salt = getSaltFromJwt(decoded);
    const zkAddress = jwtToAddress(idToken, salt);
    setAddress(zkAddress);

    setLoading(true);
    setStatus('Generating ZK proof (calling prover)...');

    requestZkProof({
      jwt: idToken,
      salt,
      maxEpoch: zkData.maxEpoch,
      randomness: zkData.randomness,
      ephemeralSecretKey: zkData.ephemeralSecretKey,
    })
      .then((proof) => {
        setStatus(
          'zkLogin ready! You can sign transactions with this address in this session (proof + ephemeral key in hand).',
        );
      })
      .catch((err) => {
        console.error('Prover request failed:', err);
        setStatus(
          `Error in Prover request: ${(err as Error).message}. Your address was generated anyway.`,
        );
      })
      .finally(() => setLoading(false));
  };

  const handleLoginClick = async () => {
    try {
      setStatus('');
      setLoading(true);
      await startGoogleLogin((message) => showToast(message, 'error'));
    } catch (e) {
      console.error(e);
      setStatus('Error starting Google login.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
      <div className="w-full max-w-md">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-xl p-8 backdrop-blur">
          <h1 className="text-2xl font-semibold text-center mb-2">
            42 zkLogin Portal
          </h1>
          <p className="text-sm text-slate-400 text-center mb-6">
            Let the student own the content they produce. Log in with your Google account,
            and a zkLogin wallet will be created for you on Sui.
          </p>

          <button
            onClick={handleLoginClick}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 transition-colors py-3 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white text-xs font-bold text-slate-900">
              G
            </span>
            <span>Continue with Google</span>
          </button>

          {loading && (
            <p className="mt-4 text-xs text-sky-300">
              Processing... (could be redirect or prover call)
            </p>
          )}

          {status && (
            <p className="mt-4 text-xs text-slate-300 whitespace-pre-line">
              {status}
            </p>
          )}

          {address && (
            <div className="mt-6 border-t border-slate-800 pt-4">
              <p className="text-xs text-slate-400 mb-1">
                Your Sui zkLogin address:
              </p>
              <p className="font-mono text-xs break-all text-sky-300">
                {address}
              </p>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          This is just a demo flow. For production, you need to set up your own prover service and salt
          management.
        </p>
      </div>
    </div>
  );
};

export default ZkLoginCard;
