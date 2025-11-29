import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Upload, FileText, Heart, Trophy, Medal, Award, Moon, Sun, User, X, ExternalLink, Loader2, LogOut, CloudUpload, CheckCircle, AlertCircle } from 'lucide-react';
import { useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import {
  useCreateStudentProfile,
  useUploadDocument,
  useVoteDocument,
  useStudentProfile,
  useLibraryStats,
  useDocuments,
} from '../lib/hooks';

interface Document {
  id: string;
  title: string;
  author: string;
  likes: number;
  blobId: string;
  description: string;
  category?: string;
}

interface LeaderboardUser {
  rank: number;
  address: string;
  points: number;
}

type DocumentsPageProps = {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
};

function DocumentsPage({ theme, setTheme }: DocumentsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    walrusBlobId: '',
    category: '',
  });
  
  // Walrus upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [walrusUploading, setWalrusUploading] = useState(false);
  const [walrusUploadStatus, setWalrusUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [walrusError, setWalrusError] = useState<string | null>(null);
  
  const isDark = theme === 'dark';

  // Sui Hooks - Wallet bağlantısı
  const account = useCurrentAccount();
  const walletAddress = account?.address;
  
  // zkLogin adresi sessionStorage'dan al
  const [zkLoginAddress, setZkLoginAddress] = useState<string | null>(null);
  const [zkLoginUserInfo, setZkLoginUserInfo] = useState<{
    email?: string;
    name?: string;
    picture?: string;
  } | null>(null);
  
  // Aktif adres: önce wallet, sonra zkLogin
  const address = walletAddress || zkLoginAddress;
  
  // zkLogin bilgilerini yükle
  useEffect(() => {
    const storedAddress = sessionStorage.getItem('zklogin_address');
    const storedUserInfo = sessionStorage.getItem('zklogin_user_info');
    
    if (storedAddress) {
      setZkLoginAddress(storedAddress);
      console.log('zkLogin adresi yüklendi:', storedAddress);
    }
    if (storedUserInfo) {
      try {
        setZkLoginUserInfo(JSON.parse(storedUserInfo));
      } catch (e) {
        console.error('zkLogin user info parse hatası:', e);
      }
    }
  }, []);

  const { execute: createProfile, isPending: isCreatingProfile } = useCreateStudentProfile();
  const { execute: uploadDoc, isPending: isUploading } = useUploadDocument();
  const { execute: vote, isPending: isVoting } = useVoteDocument();

  const { profile, loading: profileLoading, refetch: refetchProfile } = useStudentProfile(address || undefined);
  const { stats, refetch: refetchStats } = useLibraryStats();
  const { documents: blockchainDocs, loading: docsLoading, refetch: refetchDocuments } = useDocuments();

  // İlk yüklemede verileri çek
  useEffect(() => {
    if (address) {
      refetchProfile();
    }
    refetchStats();
    refetchDocuments();
  }, [address]);

  const navigate = useNavigate();
  const { mutate: disconnectWallet } = useDisconnectWallet();

  // Çıkış yap
  const handleLogout = () => {
    // Wallet bağlıysa disconnect yap
    if (walletAddress) {
      disconnectWallet();
    }
    // zkLogin verilerini temizle
    sessionStorage.removeItem('zklogin_address');
    sessionStorage.removeItem('zklogin_user_info');
    sessionStorage.removeItem('zklogin_ephemeral_data');
    sessionStorage.removeItem('sui_jwt_token');
    // State'leri temizle
    setZkLoginAddress(null);
    setZkLoginUserInfo(null);
    // Ana sayfaya yönlendir
    navigate('/');
  };

  // Profil oluştur
  const handleCreateProfile = async () => {
    try {
      await createProfile();
      setTimeout(() => refetchProfile(), 2000);
    } catch (error) {
      console.error('Profil oluşturma hatası:', error);
    }
  };

  // Walrus'a dosya yükle
  const uploadToWalrus = async (file: File): Promise<string> => {
    setWalrusUploading(true);
    setWalrusUploadStatus('uploading');
    setWalrusError(null);

    // Birden fazla proxy endpoint dene (farklı Walrus publisher'lar)
    const PROXY_ENDPOINTS = [
      '/walrus-api',    // https://publisher.walrus-testnet.walrus.space
      '/walrus-api-2',  // https://wal-publisher-testnet.staketab.org
      '/walrus-api-3',  // https://walrus-testnet-publisher.nodes.guru
      '/walrus-api-4',  // https://testnet-publisher.walrus.graphyte.dev
    ];

    console.log('Walrus\'a yükleniyor...');
    console.log('Dosya:', file.name, 'Boyut:', file.size, 'Tip:', file.type);

    let lastError: Error | null = null;

    for (const proxyEndpoint of PROXY_ENDPOINTS) {
      try {
        console.log(`Deneniyor: ${proxyEndpoint}`);
        
        const response = await fetch(`${proxyEndpoint}/v1/blobs?epochs=5`, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: file,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`${proxyEndpoint} başarısız: ${response.status} - ${errorText}`);
          lastError = new Error(`HTTP ${response.status}: ${errorText}`);
          continue;
        }

        const result = await response.json();
        console.log('Walrus response (full):', JSON.stringify(result, null, 2));
        
        // Response yapısı: { newlyCreated: { blobObject: { blobId: "..." } } } 
        // veya { alreadyCertified: { blobId: "..." } }
        const blobId = result.newlyCreated?.blobObject?.blobId || 
                       result.alreadyCertified?.blobId ||
                       result.blobId;
        
        console.log('Parsed blobId:', blobId);
        console.log('newlyCreated:', result.newlyCreated);
        console.log('alreadyCertified:', result.alreadyCertified);
        
        if (!blobId) {
          console.warn('Blob ID bulunamadı:', result);
          lastError = new Error('Blob ID alınamadı');
          continue;
        }

        setWalrusUploadStatus('success');
        setUploadForm(prev => ({ ...prev, walrusBlobId: blobId }));
        console.log('✅ Walrus upload başarılı! Blob ID:', blobId);
        console.log('🔗 Walrus URL:', `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`);
        return blobId;
      } catch (err) {
        console.warn(`${proxyEndpoint} hatası:`, err);
        lastError = err instanceof Error ? err : new Error(String(err));
        continue;
      }
    }

    // Tüm endpoint'ler başarısız olduysa
    console.error('Walrus upload hatası - tüm publisher\'lar başarısız:', lastError);
    setWalrusUploadStatus('error');
    setWalrusError(lastError?.message || 'Tüm Walrus publisher\'lar başarısız oldu');
    throw lastError || new Error('Walrus upload başarısız');
  };

  // Dosya seçildiğinde
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    
    // Otomatik olarak Walrus'a yükle
    try {
      await uploadToWalrus(file);
    } catch {
      // Hata zaten state'te
    }
  };

  // Döküman yükle (blockchain'e kaydet)
  const handleUploadDocument = async () => {
    if (!profile) {
      alert('Önce profil oluşturmalısınız!');
      return;
    }

    if (!uploadForm.walrusBlobId) {
      alert('Lütfen önce bir dosya yükleyin!');
      return;
    }

    try {
      await uploadDoc(
        profile.id,
        uploadForm.title,
        uploadForm.description,
        uploadForm.walrusBlobId,
        uploadForm.category
      );
      // Form'u sıfırla
      setUploadForm({ title: '', description: '', walrusBlobId: '', category: '' });
      setSelectedFile(null);
      setWalrusUploadStatus('idle');
      setShowUploadModal(false);
      setTimeout(() => {
        refetchProfile();
        refetchDocuments();
      }, 2000);
    } catch (error) {
      console.error('Döküman yükleme hatası:', error);
    }
  };

  // Blockchain'den gelen dökümanları Document tipine dönüştür
  // Eğer blockchain'den veri yoksa mock data kullan
  const mockDocuments: Document[] = [
    { 
      id: '1', 
      title: 'Push_Swap', 
      author: '0x12...ab', 
      likes: 124, 
      blobId: 'blob123', 
      description: 'Bu proje, iki yığın kullanarak sayıları sıralama algoritmasını içerir.' 
    },
    { 
      id: '2', 
      title: 'Philosophers', 
      author: '0x34...cd', 
      likes: 98, 
      blobId: 'blob456', 
      description: 'Klasik filozoflar yemek problemi üzerine thread ve mutex kullanımını içeren bir proje.' 
    },
    { 
      id: '3', 
      title: 'Minishell', 
      author: '0x56...ef', 
      likes: 156, 
      blobId: 'blob789', 
      description: 'Bash benzeri bir shell uygulaması. Pipe, redirection, environment variables içerir.' 
    },
    { 
      id: '4', 
      title: 'Cub3D', 
      author: '0x78...gh', 
      likes: 87, 
      blobId: 'blob012', 
      description: 'Raycasting tekniği kullanılarak yapılmış 3D labirent oyunu.' 
    },
    
  ];

  // Blockchain dökümanlarını UI formatına dönüştür
  const documents: Document[] = blockchainDocs.length > 0 
    ? blockchainDocs.map(doc => ({
        id: doc.id,
        title: doc.title,
        author: `${doc.uploader.slice(0, 6)}...${doc.uploader.slice(-4)}`,
        likes: doc.votes,
        blobId: doc.walrusBlobId,
        description: doc.description || 'Açıklama yok',
        category: doc.category,
      }))
    : mockDocuments;

  const leaderboard: LeaderboardUser[] = [
    { rank: 1, address: '0x12...ab', points: 1250 },
    { rank: 2, address: '0x34...cd', points: 980 },
    { rank: 3, address: '0x56...ef', points: 750 },
    { rank: 4, address: '0x78...gh', points: 620 },
    { rank: 5, address: '0x9a...ij', points: 510 },
  ];

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className={`w-5 h-5 ${isDark ? 'text-yellow-400' : 'text-yellow-500'}`} />;
      case 2:
        return <Medal className={`w-5 h-5 ${isDark ? 'text-gray-300' : 'text-gray-500'}`} />;
      case 3:
        return <Award className={`w-5 h-5 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />;
      default:
        return <span className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{rank}</span>;
    }
  };
  

  // Blockchain'e oy gönder
  const handleLike = async (docId: string) => {
    if (!address) {
      alert('Lütfen cüzdanınızı bağlayın!');
      return;
    }

    // Mock document ise gerçek oy gönderme
    if (docId.length < 10) {
      console.log('Mock document, skipping blockchain vote');
      return;
    }

    try {
      await vote(docId);
      setTimeout(() => refetchDocuments(), 2000);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('E_ALREADY_VOTED') || errorMessage.includes('0')) {
        alert('Bu dökümana zaten oy verdiniz!');
      } else if (errorMessage.includes('E_CANNOT_VOTE_OWN_DOCUMENT') || errorMessage.includes('1')) {
        alert('Kendi dökümanınıza oy veremezsiniz!');
      } else {
        console.error('Oy verme hatası:', error);
      }
    }
  };

  const openWalrusLink = (blobId: string, title?: string) => {
    // Walrus Aggregator URL
    const walrusUrl = `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`;
    
    // Blob ID'yi konsola yazdır (debug için)
    console.log('Opening Walrus file:', { blobId, title, url: walrusUrl });
    
    // Direkt URL'i aç - tarayıcı dosyayı indirecek
    // Kullanıcı indirilen dosyanın uzantısını .pdf olarak değiştirmeli
    window.open(walrusUrl, '_blank');
  };
  
  // Dosyayı fetch edip doğru isimle indirme fonksiyonu
  const downloadWalrusFile = async (blobId: string, filename: string) => {
    try {
      const walrusUrl = `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`;
      console.log('Downloading:', walrusUrl);
      
      const response = await fetch(walrusUrl);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      
      // Dosya adına uzantı ekle (yoksa)
      let finalFilename = filename;
      if (!filename.includes('.')) {
        finalFilename = `${filename}.pdf`; // Varsayılan olarak PDF
      }
      
      // Dosyayı indir
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = finalFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log('Download complete:', finalFilename);
    } catch (error) {
      console.error('Download error:', error);
      alert('Dosya indirilemedi. Lütfen tekrar deneyin.');
    }
  };

  // Arama filtreleme
  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className="min-h-screen w-full font-sans transition-colors duration-300 flex relative overflow-hidden"
      style={isDark ? { backgroundColor: '#211832' } : { backgroundColor: '#ECEBDE' }}
    >
      {/* Leaderboard - Sol taraf */}
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="w-48 border-r p-4 space-y-3"
        style={isDark 
          ? { borderColor: '#5C3E94', backgroundColor: '#2d1f45' } 
          : { borderColor: '#C1BAA1', backgroundColor: '#D7D3BF' }
        }
      >
        <h2 className={`text-lg font-bold ${isDark ? 'text-[#F25912]' : 'text-[#A59D84]'}`}>
          Leaderboard
        </h2>
        <div className="space-y-2">
          {leaderboard.map((user, index) => (
            <motion.div
              key={user.address}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-2 rounded-lg border ${
                isDark ? 'border-[#5C3E94]/30 bg-[#412B6B]/50' : 'border-[#A59D84]/30 bg-[#ECEBDE]/50'
              }`}
            >
              <div className="flex items-center gap-2">
                {getRankIcon(user.rank)}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-mono truncate ${isDark ? 'text-slate-200' : 'text-[#A59D84]'}`}>
                    {user.address}
                  </p>
                  <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-[#A59D84]/70'}`}>
                    {user.points} pts
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats */}
        <div className={`mt-4 p-3 rounded-lg border ${
          isDark ? 'border-[#5C3E94]/30 bg-[#412B6B]/30' : 'border-[#A59D84]/30 bg-[#ECEBDE]/50'
        }`}>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-[#A59D84]'}`}>
            Toplam Döküman
          </p>
          <p className={`text-2xl font-bold ${isDark ? 'text-[#F25912]' : 'text-[#A59D84]'}`}>
            {stats?.totalDocuments || documents.length}
          </p>
        </div>

        {/* zkLogin Kullanıcı Bilgisi */}
        {zkLoginUserInfo && (
          <div className={`mt-3 p-3 rounded-lg border ${
            isDark ? 'border-[#5C3E94]/30 bg-[#412B6B]/30' : 'border-[#A59D84]/30 bg-[#ECEBDE]/50'
          }`}>
            <div className="flex items-center gap-2">
              {zkLoginUserInfo.picture && (
                <img 
                  src={zkLoginUserInfo.picture} 
                  alt="Profile" 
                  className="w-8 h-8 rounded-full"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {zkLoginUserInfo.name || zkLoginUserInfo.email}
                </p>
                <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-[#A59D84]'}`}>
                  zkLogin
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Profil Durumu */}
        {address && (
          <div className={`mt-3 p-3 rounded-lg border ${
            isDark ? 'border-[#5C3E94]/30 bg-[#412B6B]/30' : 'border-[#A59D84]/30 bg-[#ECEBDE]/50'
          }`}>
            {profileLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className={`w-4 h-4 animate-spin ${isDark ? 'text-slate-400' : 'text-[#A59D84]'}`} />
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-[#A59D84]'}`}>Yükleniyor...</span>
              </div>
            ) : profile ? (
              <div>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-[#A59D84]'}`}>Profilim</p>
                <p className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {profile.totalUploads} yükleme
                </p>
              </div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCreateProfile}
                disabled={isCreatingProfile || !walletAddress}
                className={`w-full py-2 px-3 rounded-lg text-xs font-medium ${
                  isDark 
                    ? 'bg-[#F25912] text-white hover:bg-[#F25912]/80' 
                    : 'bg-[#A59D84] text-white hover:bg-[#A59D84]/80'
                } disabled:opacity-50`}
              >
                {isCreatingProfile ? 'Oluşturuluyor...' : zkLoginAddress && !walletAddress ? 'Cüzdan Bağla (zkLogin profil için)' : 'Profil Oluştur'}
              </motion.button>
            )}
          </div>
        )}
      </motion.div>

      {/* Ana içerik alanı */}
      <div className="flex-1 flex flex-col">
        {/* Header - Search, Upload, Theme ve Profile */}
        <div className="p-6 flex items-center gap-4 relative z-30 bg-opacity-100"
          style={isDark ? { backgroundColor: '#211832' } : { backgroundColor: '#ECEBDE' }}
        >
          {/* Search Bar - Daha büyük */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex-1 relative"
          >
            <Search className={`absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 ${
              isDark ? 'text-slate-400' : 'text-[#A59D84]'
            }`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className={`w-full h-16 pl-14 pr-6 text-lg rounded-2xl border-2 outline-none transition-all ${
                isDark 
                  ? 'bg-[#412B6B] border-[#5C3E94]/40 text-slate-100 placeholder-slate-400 focus:border-[#F25912]' 
                  : 'bg-white border-[#C1BAA1]/40 text-slate-900 placeholder-[#A59D84] focus:border-[#A59D84]'
              }`}
            />
          </motion.div>

          {/* Upload Button */}
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (!profile) {
                alert('Önce sol panelden profil oluşturmalısınız!');
                return;
              }
              setShowUploadModal(true);
            }}
            className={`h-16 flex items-center gap-3 px-6 rounded-2xl border-2 font-semibold transition-all ${
              isDark 
                ? 'border-[#5C3E94] bg-[#412B6B] hover:bg-[#5C3E94] text-slate-200' 
                : 'border-[#A59D84] bg-[#D7D3BF] hover:bg-[#A59D84] text-slate-900'
            }`}
          >
            <Upload className={`w-6 h-6 ${isDark ? 'text-[#F25912]' : 'text-[#A59D84]'}`} />
            <span className="text-base">Upload</span>
          </motion.button>

          {/* Theme Switcher + Logout Button */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="h-16 flex items-center gap-3 px-4 rounded-2xl border-2"
            style={isDark 
              ? { borderColor: '#5C3E94', backgroundColor: '#412B6B' } 
              : { borderColor: '#A59D84', backgroundColor: '#D7D3BF' }
            }
          >
            {/* Theme Switcher - Toggle style */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={`relative w-14 h-7 rounded-full p-1 transition-colors duration-300 backdrop-blur-sm border ${
                isDark ? 'border-[#5C3E94]/40' : 'border-[#A59D84]/40'
              }`}
              style={isDark 
                ? { backgroundColor: '#2d1f45' } 
                : { backgroundColor: '#C1BAA1' }
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
                className={`absolute top-0.5 w-6 h-6 rounded-full shadow-md flex items-center justify-center ${
                  isDark ? 'left-7' : 'left-0.5'
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
            </motion.button>

            {/* Vertical Divider */}
            <div className={`w-px h-10 ${isDark ? 'bg-[#5C3E94]/30' : 'bg-[#A59D84]/30'}`} />

            {/* Logout Button */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleLogout}
              transition={{ type: "spring", stiffness: 200 }}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                isDark 
                  ? 'hover:bg-[#F25912]/20' 
                  : 'hover:bg-[#A59D84]/20'
              }`}
              title="Çıkış Yap"
            >
              <LogOut className={`w-5 h-5 ${isDark ? 'text-[#F25912]' : 'text-[#A59D84]'}`} />
            </motion.button>
          </motion.div>

          {/* Profile Button */}
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/profile')}
            transition={{ type: "spring", stiffness: 200 }}
            className={`h-16 w-16 rounded-full overflow-hidden border-2 ${
              isDark ? 'border-[#5C3E94]' : 'border-[#A59D84]'
            }`}
          >
            <div
              className={`w-full h-full flex items-center justify-center transition-colors ${
                isDark 
                  ? 'bg-gradient-to-br from-[#5C3E94] to-[#412B6B] hover:from-[#6C4EA4] hover:to-[#5C3E94]' 
                  : 'bg-gradient-to-br from-[#A59D84] to-[#C1BAA1] hover:from-[#B5AD94] hover:to-[#D1CAB1]'
              }`}
            >
              <User className={`w-7 h-7 ${isDark ? 'text-[#F25912]' : 'text-white'}`} />
            </div>
          </motion.button>
        </div>

        {/* Documents Grid */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pb-6 pt-6">
          {docsLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-[#F25912]' : 'text-[#A59D84]'}`} />
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDocuments.map((doc, index) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.03 }}
                onClick={() => setSelectedDoc(doc)}
                className={`p-4 rounded-xl border cursor-pointer relative z-10 hover:z-20 ${
                  isDark 
                    ? 'border-[#5C3E94]/40 bg-[#412B6B]/50 hover:border-[#F25912]/60 hover:shadow-2xl' 
                    : 'border-[#C1BAA1]/40 bg-white hover:border-[#A59D84]/60 hover:shadow-2xl'
                }`}
                style={{
                  transformOrigin: 'center center'
                }}
              >
                {/* PDF Icon + Title */}
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isDark ? 'bg-[#5C3E94]/30' : 'bg-[#A59D84]/20'
                  }`}>
                    <FileText className={`w-5 h-5 ${isDark ? 'text-[#F25912]' : 'text-[#A59D84]'}`} />
                  </div>
                  <h3 className={`font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    {doc.title}
                  </h3>
                </div>

                {/* Author */}
                <p className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-[#A59D84]'}`}>
                  Yazar: {doc.author}
                </p>

                <div className={`h-px mb-4 ${isDark ? 'bg-[#5C3E94]/30' : 'bg-[#C1BAA1]/30'}`} />

                {/* Like Button Only */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent modal from opening
                    handleLike(doc.id);
                  }}
                  disabled={isVoting}
                  className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium ${
                    isDark 
                      ? 'bg-[#F25912] text-white hover:bg-[#F25912]/80' 
                      : 'bg-[#C1BAA1] text-white hover:bg-[#C1BAA1]/80'
                  } disabled:opacity-50`}
                >
                  <Heart className="w-4 h-4" />
                  {isVoting ? '...' : `BEĞEN (${doc.likes})`}
                </motion.button>

                <p className={`text-[10px] mt-2 text-center ${isDark ? 'text-slate-500' : 'text-[#A59D84]/60'}`}>
                  Tıklayarak detayları görüntüleyin
                </p>
              </motion.div>
            ))}
          </div>
          )}
        </div>
      </div>

      {/* Document Detail Modal */}
      <AnimatePresence>
        {selectedDoc && (
          <>
            {/* Backdrop with blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDoc(null)}
              className="fixed inset-0 z-40"
              style={{
                backdropFilter: 'blur(10px)',
                backgroundColor: isDark ? 'rgba(33, 24, 50, 0.8)' : 'rgba(236, 235, 222, 0.8)'
              }}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 50 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-8"
            >
              <div
                className={`relative w-full max-w-3xl rounded-2xl shadow-2xl border-2 overflow-hidden ${
                  isDark 
                    ? 'bg-[#412B6B] border-[#5C3E94]' 
                    : 'bg-white border-[#C1BAA1]'
                }`}
              >
                {/* Close Button */}
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedDoc(null)}
                  className={`absolute top-4 right-4 z-10 p-2 rounded-full ${
                    isDark 
                      ? 'bg-[#5C3E94] hover:bg-[#F25912]' 
                      : 'bg-[#A59D84] hover:bg-[#C1BAA1]'
                  }`}
                >
                  <X className="w-6 h-6 text-white" />
                </motion.button>

                {/* Modal Header */}
                <div className={`p-8 border-b ${isDark ? 'border-[#5C3E94]/30' : 'border-[#C1BAA1]/30'}`}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
                      isDark ? 'bg-[#5C3E94]/30' : 'bg-[#A59D84]/20'
                    }`}>
                      <FileText className={`w-8 h-8 ${isDark ? 'text-[#F25912]' : 'text-[#A59D84]'}`} />
                    </div>
                    <div>
                      <h2 className={`text-3xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                        {selectedDoc.title}
                      </h2>
                      <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-[#A59D84]'}`}>
                        Yazar: {selectedDoc.author}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Modal Body */}
                <div className="p-8 space-y-6">
                  {/* Açıklama */}
                  <div>
                    <h3 className={`text-xl font-semibold mb-3 ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                      Proje Açıklaması
                    </h3>
                    <p className={`text-base leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {selectedDoc.description}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4">
                    {/* Walrus Link Button */}
                    {/* <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => openWalrusLink(selectedDoc.blobId, selectedDoc.title)}
                      disabled={selectedDoc.blobId.startsWith('blob')} // Mock data için devre dışı
                      className={`flex-1 flex items-center justify-center gap-3 py-4 px-6 rounded-xl text-lg font-semibold shadow-lg ${
                        selectedDoc.blobId.startsWith('blob')
                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                          : isDark 
                          ? 'bg-gradient-to-r from-[#5C3E94] to-[#412B6B] text-white hover:from-[#6C4EA4] hover:to-[#5C3E94]' 
                          : 'bg-gradient-to-r from-[#A59D84] to-[#C1BAA1] text-white hover:from-[#B5AD94] hover:to-[#D1CAB1]'
                      }`}
                      title={selectedDoc.blobId.startsWith('blob') ? 'Bu örnek veri, gerçek dosya değil' : `Blob ID: ${selectedDoc.blobId}`}
                    >
                      <ExternalLink className="w-6 h-6" />
                      {selectedDoc.blobId.startsWith('blob') ? 'Örnek Veri' : 'Dosyayı Görüntüle'}
                    </motion.button>
 */}
                    {/* Download Button - Sadece gerçek dosyalar için */}
                    {/* Download Button */}
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => downloadWalrusFile(selectedDoc.blobId, selectedDoc.title)}
                        disabled={selectedDoc.blobId.startsWith('blob')}
                        className={`flex-1 flex items-center justify-center gap-3 py-4 px-6 rounded-xl text-lg font-semibold shadow-lg ${
                          selectedDoc.blobId.startsWith('blob')
                            ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                            : isDark
                            ? 'bg-gradient-to-r from-green-600 to-green-500 text-white hover:from-green-500 hover:to-green-400'
                            : 'bg-gradient-to-r from-green-500 to-green-400 text-white hover:from-green-400 hover:to-green-300'
                        }`}
                      >
                        <FileText className="w-6 h-6" />
                        {!selectedDoc.blobId.startsWith('blob') ? 'İndir (.pdf)' : 'İndirilemez'}
                      </motion.button>
                    {/* Like Button */}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleLike(selectedDoc.id)}
                      disabled={isVoting}
                      className={`flex items-center justify-center gap-3 py-4 px-6 rounded-xl text-lg font-semibold shadow-lg ${
                        isDark 
                          ? 'bg-[#F25912] text-white hover:bg-[#F25912]/80' 
                          : 'bg-[#C1BAA1] text-white hover:bg-[#C1BAA1]/80'
                      } disabled:opacity-50`}
                    >
                      <Heart className="w-6 h-6" />
                      {isVoting ? '...' : selectedDoc.likes}
                    </motion.button>
                    {/* report butonu */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleReport(selectedDoc.id)}
                    className={`flex items-center justify-center gap-3 py-4 px-6 rounded-xl text-lg font-semibold shadow-lg ${
                      isDark
                        ? 'bg-red-600 text-white hover:bg-red-500'
                        : 'bg-red-500 text-white hover:bg-red-400'
                    }`}
                  >
                    ⚠️ Report
                  </motion.button>
                  </div>


                  {/* Blob ID gösterimi */}
                  {!selectedDoc.blobId.startsWith('blob') && (
                    <div className={`mt-2 p-2 rounded-lg ${isDark ? 'bg-[#2d1f45]' : 'bg-gray-100'}`}>
                      <p className={`text-xs font-mono break-all ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        <span className="font-semibold">Blob ID:</span> {selectedDoc.blobId}
                      </p>
                    </div>
                  )}

                  {/* Info Text */}
                  <p className={`text-xs text-center ${isDark ? 'text-slate-500' : 'text-[#A59D84]/60'}`}>
                    {selectedDoc.blobId.startsWith('blob') 
                      ? 'Bu örnek veridir. Gerçek dosya görmek için yeni bir döküman yükleyin.'
                      : 'Dosyayı görüntülemek veya indirmek için butonları kullanın. Beğeni butonu Sui blockchain\'e sinyal gönderir.'
                    }
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUploadModal(false)}
              className="fixed inset-0 z-40"
              style={{
                backdropFilter: 'blur(10px)',
                backgroundColor: isDark ? 'rgba(33, 24, 50, 0.8)' : 'rgba(236, 235, 222, 0.8)'
              }}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 50 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-8"
            >
              <div
                className={`relative w-full max-w-lg rounded-2xl shadow-2xl border-2 overflow-hidden ${
                  isDark 
                    ? 'bg-[#412B6B] border-[#5C3E94]' 
                    : 'bg-white border-[#C1BAA1]'
                }`}
              >
                {/* Close Button */}
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowUploadModal(false)}
                  className={`absolute top-4 right-4 z-10 p-2 rounded-full ${
                    isDark 
                      ? 'bg-[#5C3E94] hover:bg-[#F25912]' 
                      : 'bg-[#A59D84] hover:bg-[#C1BAA1]'
                  }`}
                >
                  <X className="w-5 h-5 text-white" />
                </motion.button>

                {/* Modal Header */}
                <div className={`p-6 border-b ${isDark ? 'border-[#5C3E94]/30' : 'border-[#C1BAA1]/30'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      isDark ? 'bg-[#5C3E94]/30' : 'bg-[#A59D84]/20'
                    }`}>
                      <Upload className={`w-6 h-6 ${isDark ? 'text-[#F25912]' : 'text-[#A59D84]'}`} />
                    </div>
                    <h2 className={`text-2xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                      Yeni Döküman Yükle
                    </h2>
                  </div>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-4">
                  {/* Dosya Yükleme Alanı */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Dosya Seç (Walrus'a yüklenecek)
                    </label>
                    <div
                      className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                        walrusUploadStatus === 'success'
                          ? isDark ? 'border-green-500/60 bg-green-500/10' : 'border-green-500/60 bg-green-50'
                          : walrusUploadStatus === 'error'
                          ? isDark ? 'border-red-500/60 bg-red-500/10' : 'border-red-500/60 bg-red-50'
                          : isDark 
                          ? 'border-[#5C3E94]/40 hover:border-[#F25912]/60 bg-[#2d1f45]' 
                          : 'border-[#C1BAA1]/40 hover:border-[#A59D84]/60 bg-white'
                      }`}
                    >
                      <input
                        type="file"
                        onChange={handleFileSelect}
                        accept=".pdf,.doc,.docx,.txt,.md"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={walrusUploading}
                      />
                      
                      {walrusUploading ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-[#F25912]' : 'text-[#A59D84]'}`} />
                          <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                            Walrus'a yükleniyor...
                          </p>
                        </div>
                      ) : walrusUploadStatus === 'success' ? (
                        <div className="flex flex-col items-center gap-2">
                          <CheckCircle className="w-8 h-8 text-green-500" />
                          <p className={`text-sm font-medium ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                            {selectedFile?.name} yüklendi!
                          </p>
                          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Başka bir dosya seçmek için tıklayın
                          </p>
                        </div>
                      ) : walrusUploadStatus === 'error' ? (
                        <div className="flex flex-col items-center gap-2">
                          <AlertCircle className="w-8 h-8 text-red-500" />
                          <p className={`text-sm font-medium ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                            Yükleme başarısız!
                          </p>
                          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {walrusError || 'Tekrar deneyin'}
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <CloudUpload className={`w-8 h-8 ${isDark ? 'text-[#F25912]' : 'text-[#A59D84]'}`} />
                          <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                            Dosya seçmek için tıklayın veya sürükleyin
                          </p>
                          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            PDF, DOC, DOCX, TXT, MD desteklenir
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Walrus Blob ID (otomatik doldurulur veya manuel girilebilir) */}
                  {uploadForm.walrusBlobId && (
                    <div className={`p-3 rounded-lg ${isDark ? 'bg-[#2d1f45]' : 'bg-gray-50'}`}>
                      <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Walrus Blob ID:
                      </p>
                      <p className={`text-sm font-mono break-all ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                        {uploadForm.walrusBlobId}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Başlık
                    </label>
                    <input
                      type="text"
                      value={uploadForm.title}
                      onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                      placeholder="Döküman başlığı"
                      className={`w-full p-3 rounded-lg border outline-none ${
                        isDark 
                          ? 'bg-[#2d1f45] border-[#5C3E94]/40 text-slate-100 placeholder-slate-500 focus:border-[#F25912]' 
                          : 'bg-white border-[#C1BAA1]/40 text-slate-900 placeholder-[#A59D84] focus:border-[#A59D84]'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Açıklama
                    </label>
                    <textarea
                      value={uploadForm.description}
                      onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                      placeholder="Döküman açıklaması"
                      rows={2}
                      className={`w-full p-3 rounded-lg border outline-none resize-none ${
                        isDark 
                          ? 'bg-[#2d1f45] border-[#5C3E94]/40 text-slate-100 placeholder-slate-500 focus:border-[#F25912]' 
                          : 'bg-white border-[#C1BAA1]/40 text-slate-900 placeholder-[#A59D84] focus:border-[#A59D84]'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Kategori
                    </label>
                    <select
                      value={uploadForm.category}
                      onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                      className={`w-full p-3 rounded-lg border outline-none ${
                        isDark 
                          ? 'bg-[#2d1f45] border-[#5C3E94]/40 text-slate-100 focus:border-[#F25912]' 
                          : 'bg-white border-[#C1BAA1]/40 text-slate-900 focus:border-[#A59D84]'
                      }`}
                    >
                      <option value="">Kategori seçin</option>
                      <option value="42 Project">42 Project</option>
                      <option value="Programlama">Programlama</option>
                      <option value="Matematik">Matematik</option>
                      <option value="Fizik">Fizik</option>
                      <option value="Blockchain">Blockchain</option>
                      <option value="Diğer">Diğer</option>
                    </select>
                  </div>

                  {/* Upload Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleUploadDocument}
                    disabled={isUploading || !uploadForm.title || !uploadForm.walrusBlobId || !uploadForm.category}
                    className={`w-full py-4 rounded-xl text-lg font-semibold shadow-lg ${
                      isDark 
                        ? 'bg-[#F25912] text-white hover:bg-[#F25912]/80' 
                        : 'bg-[#A59D84] text-white hover:bg-[#A59D84]/80'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isUploading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Blockchain'e kaydediliyor...
                      </span>
                    ) : (
                      'Dökümanı Kaydet'
                    )}
                  </motion.button>

                  <p className={`text-xs text-center ${isDark ? 'text-slate-500' : 'text-[#A59D84]/60'}`}>
                    Dosya Walrus'a, bilgiler Sui blockchain'e kaydedilir.
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DocumentsPage;
