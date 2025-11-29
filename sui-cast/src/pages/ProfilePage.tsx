import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, FileText, Award, Trophy, Medal, ArrowLeft, Edit2, Check, X, Heart, Loader2, Copy } from 'lucide-react';
import { CheckCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useDocuments } from '../lib/hooks';

interface NFT {
  id: string;
  name: string;
  image: string;
  rarity: 'common' | 'rare' | 'legendary';
}

interface Project {
  id: string;
  title: string;
  description: string;
  likes: number;
  blobId: string;
  category?: string;
}

type ProfilePageProps = {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
};

function ProfilePage({ theme, setTheme }: ProfilePageProps) {
  const navigate = useNavigate();
  const { address } = useParams<{ address?: string }>();
  
  const [aboutMe, setAboutMe] = useState('42 öğrencisiyim. C, C++ ve sistem programlama konularında uzmanlaşıyorum. Blockchain ve Web3 teknolojilerine ilgi duyuyorum.');
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [tempAboutMe, setTempAboutMe] = useState(aboutMe);
  const [profileAddress, setProfileAddress] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  
  const isDark = theme === 'dark';
  const [isOwner, setIsOwner] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [copiedBlobId, setCopiedBlobId] = useState(false);

  // Wallet ve blockchain hooks
  const account = useCurrentAccount();
  const { documents: blockchainDocs, loading: docsLoading, refetch: refetchDocuments } = useDocuments();

  // İlk yüklemede dokümanları çek
  useEffect(() => {
    refetchDocuments();
  }, []);

  // Kullanıcıya ait dokümanları filtrele
  const currentUserAddress = account?.address || sessionStorage.getItem('zklogin_address');
  const viewingAddress = address || currentUserAddress;
  
  const userProjects = blockchainDocs
    .filter(doc => doc.uploader === viewingAddress)
    .map(doc => ({
      id: doc.id,
      title: doc.title,
      description: doc.description || 'Açıklama yok',
      likes: doc.votes,
      blobId: doc.walrusBlobId,
      category: doc.category,
    }));

  // Kullanıcının toplam puanı (aldığı toplam beğeni)
  const userPoints = userProjects.reduce((total, project) => total + project.likes, 0);

  // Mock data - NFT'ler için
  const userRank: number = 1;

  const nfts: NFT[] = [
    { id: '1', name: 'Golden Trophy', image: '🏆', rarity: 'legendary' },
    { id: '2', name: 'Silver Medal', image: '🥈', rarity: 'rare' },
    { id: '3', name: 'Bronze Star', image: '⭐', rarity: 'common' },
  ];

  const getRankIcon = () => {
    switch (userRank) {
      case 1:
        return <Trophy className="w-12 h-12 text-yellow-400" />;
      case 2:
        return <Medal className="w-12 h-12 text-gray-300" />;
      case 3:
        return <Award className="w-12 h-12 text-orange-400" />;
      default:
        return <span className="text-4xl font-bold">{userRank}</span>;
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary':
        return isDark ? 'from-yellow-600 to-yellow-400' : 'from-yellow-500 to-yellow-300';
      case 'rare':
        return isDark ? 'from-purple-600 to-purple-400' : 'from-purple-500 to-purple-300';
      default:
        return isDark ? 'from-gray-600 to-gray-400' : 'from-gray-500 to-gray-300';
    }
  };

  const handleEditAbout = () => {
    setTempAboutMe(aboutMe);
    setIsEditingAbout(true);
  };

  const handleSaveAbout = () => {
    setAboutMe(tempAboutMe);
    setIsEditingAbout(false);
  };

  const handleCancelAbout = () => {
    setTempAboutMe(aboutMe);
    setIsEditingAbout(false);
  };

  // Blob ID kopyalama
  const handleCopyBlobId = async (blobId: string) => {
    try {
      await navigator.clipboard.writeText(blobId);
      setCopiedBlobId(true);
      setTimeout(() => setCopiedBlobId(false), 2000);
    } catch (err) {
      console.error('Kopyalama hatası:', err);
    }
  };

  // Dosyayı indirme
  const downloadWalrusFile = async (blobId: string, filename: string) => {
    try {
      const walrusUrl = `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`;
      const response = await fetch(walrusUrl);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      let finalFilename = filename;
      if (!filename.includes('.')) {
        finalFilename = `${filename}.pdf`;
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = finalFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      alert('Dosya indirilemedi. Lütfen tekrar deneyin.');
    }
  };

  // Get current logged-in user's address from localStorage
  useEffect(() => {
    const zkAddress = localStorage.getItem('zkLoginAddress');
    const zkUserInfo = localStorage.getItem('zkLoginUserInfo');
    
    // If no address in URL, show current user's profile
    if (!address && zkAddress) {
      setProfileAddress(zkAddress);
      if (zkUserInfo) {
        try {
          setUserInfo(JSON.parse(zkUserInfo));
        } catch (e) {
          console.error('Failed to parse user info:', e);
        }
      }
    } else if (address) {
      // Show specific user's profile
      setProfileAddress(address);
      // TODO: Fetch user info from blockchain/API for this address
      // For now, if it's the current user, show their info
      if (zkAddress === address && zkUserInfo) {
        try {
          setUserInfo(JSON.parse(zkUserInfo));
        } catch (e) {
          console.error('Failed to parse user info:', e);
        }
      }
    }
    
    // Check if logged-in user is the profile owner
    if (zkAddress && address && zkAddress === address) {
      setIsOwner(true);
    } else if (!address && zkAddress) {
      // If no address in URL and user is logged in, they're viewing their own profile
      setIsOwner(true);
    } else {
      setIsOwner(false);
    }
  }, [address]);

  return (
    <div
      className="min-h-screen w-full font-sans transition-colors duration-300 overflow-auto"
      style={isDark ? { backgroundColor: '#211832' } : { backgroundColor: '#ECEBDE' }}
    >
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header - 3 Columns: Rank/Points | 42 Logo (Center) | Theme/Back */}
        <div className="grid grid-cols-3 items-start gap-4">
          {/* Left - Rank and Points */}
          <motion.div
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex items-center gap-4"
          >
            {/* Rank Badge */}
            <div
              className={`w-32 h-32 rounded-2xl flex flex-col items-center justify-center border-4 ${
                isDark ? 'bg-[#412B6B] border-[#5C3E94]' : 'bg-white border-[#A59D84]'
              }`}
            >
              {getRankIcon()}
              <span className={`text-sm mt-2 font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Sıralama
              </span>
            </div>
            {/* Points Card */}
            <div
              className={`h-32 flex flex-col justify-center px-6 rounded-xl border-2 ${
                isDark ? 'bg-[#412B6B] border-[#5C3E94]' : 'bg-white border-[#A59D84]'
              }`}
            >
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-[#A59D84]'}`}>
                Toplam Puan
              </p>
              <p className={`text-3xl font-bold ${isDark ? 'text-[#F25912]' : 'text-[#A59D84]'}`}>
                {userPoints}
              </p>
            </div>
          </motion.div>

          {/* Center - SUI-CAST Text - Expanded to fill top */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex justify-center"
          >
            <div
              className={`h-32 w-full rounded-2xl flex items-center justify-center border-4 ${
                isDark ? 'bg-[#412B6B] border-[#5C3E94]' : 'bg-white border-[#A59D84]'
              }`}
            >
              <span 
                    className={`
                        font-russo text-6xl tracking-widest
                        bg-gradient-to-r from-purple-400 to-blue-500
                        bg-clip-text text-transparent
                        drop-shadow-[0_0_8px_rgba(120,70,255,0.35)]
                    `}
              >
                SUI-CAST
              </span>
            </div>
          </motion.div>

          {/* Right - Theme Toggle and Back Button */}
          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex items-center justify-end gap-3"
          >
            {/* Theme Toggle - Small toggle style like DocumentsPage */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="h-32 flex items-center gap-3 px-4 rounded-2xl border-2"
              style={isDark 
                ? { borderColor: '#5C3E94', backgroundColor: '#412B6B' } 
                : { borderColor: '#A59D84', backgroundColor: 'white' }
              }
            >
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
            </motion.div>

            {/* Back to Documents Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/app')}
              className={`h-32 flex flex-col items-center justify-center gap-2 px-6 rounded-2xl border-4 font-semibold ${
                isDark
                  ? 'border-[#5C3E94] bg-[#412B6B] hover:bg-[#5C3E94] text-slate-200'
                  : 'border-[#A59D84] bg-white hover:bg-[#A59D84] text-slate-900'
              }`}
            >
              <ArrowLeft className="w-8 h-8" />
              <span className="text-sm">Dökümanlar</span>
            </motion.button>
          </motion.div>
        </div>

        {/* Profile Section */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className={`p-8 rounded-2xl border-2 ${
            isDark ? 'bg-[#412B6B] border-[#5C3E94]' : 'bg-white border-[#A59D84]'
          }`}
        >
          <div className="flex items-center gap-8">
            {/* Profile Picture */}
            <div
              className={`w-48 h-48 rounded-full border-4 overflow-hidden ${
                isDark ? 'border-[#5C3E94]' : 'border-[#A59D84]'
              }`}
            >
              <div
                className={`w-full h-full flex items-center justify-center text-6xl ${
                  isDark ? 'bg-gradient-to-br from-[#5C3E94] to-[#412B6B]' : 'bg-gradient-to-br from-[#A59D84] to-[#C1BAA1]'
                }`}
              >
                {userInfo?.picture ? (
                  <img src={userInfo.picture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  '👤'
                )}
              </div>
            </div>
            {/* About Me */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className={`text-4xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    {userInfo?.name || 'Hakkımda'}
                  </h2>
                  {profileAddress && (
                    <p className={`text-sm mt-1 font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {profileAddress.slice(0, 6)}...{profileAddress.slice(-4)}
                    </p>
                  )}
                </div>
                {!isEditingAbout && isOwner && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleEditAbout}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors ${
                      isDark
                        ? 'border-[#5C3E94] bg-[#2d1f45] hover:bg-[#5C3E94] text-slate-200'
                        : 'border-[#A59D84] bg-[#ECEBDE] hover:bg-[#A59D84] text-slate-900'
                    }`}
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Düzenle</span>
                  </motion.button>
                )}
              </div>
              {isEditingAbout ? (
                <div className="space-y-3">
                  <textarea
                    value={tempAboutMe}
                    onChange={(e) => setTempAboutMe(e.target.value)}
                    className={`w-full h-32 p-4 rounded-lg border-2 text-lg resize-none transition-colors ${
                      isDark
                        ? 'bg-[#2d1f45] border-[#5C3E94] text-slate-200 focus:border-[#F25912]'
                        : 'bg-white border-[#A59D84] text-slate-900 focus:border-[#A59D84]'
                    } focus:outline-none focus:ring-2 ${
                      isDark ? 'focus:ring-[#F25912]/30' : 'focus:ring-[#A59D84]/30'
                    }`}
                    placeholder="Kendiniz hakkında bilgi yazın..."
                  />
                  <div className="flex gap-3">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSaveAbout}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                        isDark
                          ? 'bg-[#F25912] hover:bg-[#F25912]/80 text-white'
                          : 'bg-[#A59D84] hover:bg-[#A59D84]/80 text-white'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      <span>Kaydet</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleCancelAbout}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-semibold transition-colors ${
                        isDark
                          ? 'border-[#5C3E94] bg-[#2d1f45] hover:bg-[#5C3E94] text-slate-200'
                          : 'border-[#A59D84] bg-white hover:bg-[#A59D84]/20 text-slate-900'
                      }`}
                    >
                      <X className="w-4 h-4" />
                      <span>İptal</span>
                    </motion.button>
                  </div>
                </div>
              ) : (
                <p className={`text-lg leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {aboutMe}
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* NFT Showcase */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className={`p-6 rounded-2xl border-2 ${
            isDark ? 'bg-[#412B6B] border-[#5C3E94]' : 'bg-white border-[#A59D84]'
          }`}
        >
          <h3 className={`text-2xl font-bold mb-4 ${isDark ? 'text-[#F25912]' : 'text-[#A59D84]'}`}>
            Kazandığım NFT&apos;ler Vitrin Sayfası
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {nfts.map((nft, index) => (
              <motion.div
                key={nft.id}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                className={`p-6 rounded-xl bg-gradient-to-br ${getRarityColor(nft.rarity)} flex flex-col items-center justify-center cursor-pointer shadow-lg`}
              >
                <span className="text-6xl mb-3">{nft.image}</span>
                <p className="text-white font-bold text-center">{nft.name}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* User Projects */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className={`text-2xl font-bold mb-4 ${isDark ? 'text-[#F25912]' : 'text-[#A59D84]'}`}>
            Projelerim ({userProjects.length})
          </h3>
          
          {docsLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-[#F25912]' : 'text-[#A59D84]'}`} />
            </div>
          ) : userProjects.length === 0 ? (
            <div className={`p-8 rounded-xl border-2 text-center ${
              isDark ? 'bg-[#412B6B]/30 border-[#5C3E94]/40' : 'bg-white border-[#C1BAA1]/40'
            }`}>
              <FileText className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-slate-500' : 'text-[#A59D84]/50'}`} />
              <p className={`text-lg ${isDark ? 'text-slate-400' : 'text-[#A59D84]'}`}>
                Henüz yüklenmiş döküman yok
              </p>
              {isOwner && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/app')}
                  className={`mt-4 px-6 py-2 rounded-lg font-semibold ${
                    isDark 
                      ? 'bg-[#F25912] text-white hover:bg-[#F25912]/80' 
                      : 'bg-[#A59D84] text-white hover:bg-[#A59D84]/80'
                  }`}
                >
                  İlk Dökümanını Yükle
                </motion.button>
              )}
            </div>
          ) : (
          <div className="grid grid-cols-3 gap-4">
            {userProjects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.05 }}
                whileHover={{ scale: 1.03 }}
                onClick={() => setSelectedProject(project)}
                className={`p-4 rounded-xl border-2 cursor-pointer ${
                  isDark
                    ? 'bg-[#412B6B]/50 border-[#5C3E94]/40 hover:border-[#F25912]/60 hover:shadow-xl'
                    : 'bg-white border-[#C1BAA1]/40 hover:border-[#A59D84]/60 hover:shadow-xl'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isDark ? 'bg-[#5C3E94]/30' : 'bg-[#A59D84]/20'
                    }`}
                  >
                    <FileText className={`w-5 h-5 ${isDark ? 'text-[#F25912]' : 'text-[#A59D84]'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-bold truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                      {project.title}
                    </h4>
                    {project.category && (
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        isDark ? 'bg-[#5C3E94]/50 text-slate-300' : 'bg-[#A59D84]/20 text-[#A59D84]'
                      }`}>
                        {project.category}
                      </span>
                    )}
                  </div>
                </div>
                <p className={`text-sm mb-3 line-clamp-2 ${isDark ? 'text-slate-400' : 'text-[#A59D84]'}`}>
                  {project.description}
                </p>
                <div className={`flex items-center gap-1 text-xs ${isDark ? 'text-slate-500' : 'text-[#A59D84]/70'}`}>
                  <Heart className="w-3 h-3" />
                  {project.likes} beğeni
                </div>
                <p className={`text-[10px] mt-2 text-center ${isDark ? 'text-slate-500' : 'text-[#A59D84]/60'}`}>
                  Tıklayarak detayları görüntüleyin
                </p>
              </motion.div>
            ))}
          </div>
          )}
        </motion.div>
      </div>

      {/* Project Detail Modal */}
      <AnimatePresence>
        {selectedProject && (
          <>
            {/* Backdrop with blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProject(null)}
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
                className={`relative w-full max-w-2xl rounded-2xl shadow-2xl border-2 overflow-hidden ${
                  isDark 
                    ? 'bg-[#412B6B] border-[#5C3E94]' 
                    : 'bg-white border-[#C1BAA1]'
                }`}
              >
                {/* Close Button */}
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedProject(null)}
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
                        {selectedProject.title}
                      </h2>
                      {selectedProject.category && (
                        <span className={`text-sm px-3 py-1 rounded-full mt-2 inline-block ${
                          isDark ? 'bg-[#5C3E94]/50 text-slate-300' : 'bg-[#A59D84]/20 text-[#A59D84]'
                        }`}>
                          {selectedProject.category}
                        </span>
                      )}
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
                      {selectedProject.description}
                    </p>
                  </div>

                  {/* Blob ID */}
                  <div className={`p-4 rounded-xl ${isDark ? 'bg-[#2d1f45]' : 'bg-gray-100'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Walrus Blob ID
                      </h4>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleCopyBlobId(selectedProject.blobId)}
                        className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium ${
                          copiedBlobId
                            ? 'bg-green-500 text-white'
                            : isDark 
                              ? 'bg-[#5C3E94] text-white hover:bg-[#F25912]' 
                              : 'bg-[#A59D84] text-white hover:bg-[#A59D84]/80'
                        }`}
                      >
                        {copiedBlobId ? (
                          <><CheckCircle className="w-3 h-3" /> Kopyalandı</>
                        ) : (
                          <><Copy className="w-3 h-3" /> Kopyala</>
                        )}
                      </motion.button>
                    </div>
                    <p className={`text-sm font-mono break-all ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {selectedProject.blobId}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4">
                    {/* Download Button */}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => downloadWalrusFile(selectedProject.blobId, selectedProject.title)}
                      className={`flex-1 flex items-center justify-center gap-3 py-4 px-6 rounded-xl text-lg font-semibold shadow-lg ${
                        isDark
                          ? 'bg-gradient-to-r from-green-600 to-green-500 text-white hover:from-green-500 hover:to-green-400'
                          : 'bg-gradient-to-r from-green-500 to-green-400 text-white hover:from-green-400 hover:to-green-300'
                      }`}
                    >
                      <FileText className="w-6 h-6" />
                      İndir (.pdf)
                    </motion.button>
                  </div>

                  {/* Beğeni bilgisi (sadece görüntüleme) */}
                  <div className={`flex items-center justify-center gap-2 pt-4 border-t ${isDark ? 'border-[#5C3E94]/30' : 'border-[#C1BAA1]/30'}`}>
                    <Heart className={`w-5 h-5 ${isDark ? 'text-[#F25912]' : 'text-[#A59D84]'}`} />
                    <span className={`text-lg font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {selectedProject.likes} beğeni
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ProfilePage;