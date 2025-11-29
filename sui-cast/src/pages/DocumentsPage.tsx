import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Upload, FileText, Heart, Trophy, Medal, Award, Moon, Sun, User, X, ExternalLink } from 'lucide-react';

interface Document {
  id: string;
  title: string;
  author: string;
  likes: number;
  blobId: string;
  description: string; // Yükleyen kişinin girdiği açıklama
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
  const isDark = theme === 'dark';

  // Mock data
  const documents: Document[] = [
    { 
      id: '1', 
      title: 'Push_Swap', 
      author: '0x12...ab', 
      likes: 124, 
      blobId: 'blob123', 
      description: 'Bu proje, iki yığın kullanarak sayıları sıralama algoritmasını içerir. Verimli algoritma kullanımı ve optimizasyon teknikleri uygulanmıştır.' 
    },
    { 
      id: '2', 
      title: 'Philosophers', 
      author: '0x34...cd', 
      likes: 98, 
      blobId: 'blob456', 
      description: 'Klasik filozoflar yemek problemi üzerine thread ve mutex kullanımını içeren bir proje. Deadlock ve race condition çözümleri içerir.' 
    },
    { 
      id: '3', 
      title: 'Minishell', 
      author: '0x56...ef', 
      likes: 156, 
      blobId: 'blob789', 
      description: 'Bash benzeri bir shell uygulaması. Pipe, redirection, environment variables ve built-in komutlar içerir.' 
    },
    { 
      id: '4', 
      title: 'Cub3D', 
      author: '0x78...gh', 
      likes: 87, 
      blobId: 'blob012', 
      description: 'Raycasting tekniği kullanılarak yapılmış 3D labirent oyunu. Wolfenstein 3D tarzında bir first-person görünüm sunar.' 
    },
  ];

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

  const handleLike = (docId: string) => {
    console.log('Liked document:', docId);
    // Sui'ye sinyal gönder
  };

  const openWalrusLink = (blobId: string) => {
    const walrusUrl = `https://walrus.site/${blobId}`;
    window.open(walrusUrl, '_blank');
  };

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
            className={`h-16 flex items-center gap-3 px-6 rounded-2xl border-2 font-semibold transition-all ${
              isDark 
                ? 'border-[#5C3E94] bg-[#412B6B] hover:bg-[#5C3E94] text-slate-200' 
                : 'border-[#A59D84] bg-[#D7D3BF] hover:bg-[#A59D84] text-slate-900'
            }`}
          >
            <Upload className={`w-6 h-6 ${isDark ? 'text-[#F25912]' : 'text-[#A59D84]'}`} />
            <span className="text-base">Upload</span>
          </motion.button>

          {/* Theme Switcher + 42 Logo - Vertical Stack */}
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

            {/* 42 Logo */}
            <motion.div
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="w-10 h-10 flex items-center justify-center cursor-pointer"
            >
              <img 
                src="/src/assets/42-logo.svg" 
                alt="42 School Logo" 
                className="w-8 h-8 object-contain"
                style={{ filter: isDark ? 'brightness(0) invert(1)' : 'none' }}
              />
            </motion.div>
          </motion.div>

          {/* Profile Button */}
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc, index) => (
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
                  className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium ${
                    isDark 
                      ? 'bg-[#F25912] text-white hover:bg-[#F25912]/80' 
                      : 'bg-[#C1BAA1] text-white hover:bg-[#C1BAA1]/80'
                  }`}
                >
                  <Heart className="w-4 h-4" />
                  BEĞEN ({doc.likes})
                </motion.button>

                <p className={`text-[10px] mt-2 text-center ${isDark ? 'text-slate-500' : 'text-[#A59D84]/60'}`}>
                  Tıklayarak detayları görüntüleyin
                </p>
              </motion.div>
            ))}
          </div>
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
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => openWalrusLink(selectedDoc.blobId)}
                      className={`flex-1 flex items-center justify-center gap-3 py-4 px-6 rounded-xl text-lg font-semibold shadow-lg ${
                        isDark 
                          ? 'bg-gradient-to-r from-[#5C3E94] to-[#412B6B] text-white hover:from-[#6C4EA4] hover:to-[#5C3E94]' 
                          : 'bg-gradient-to-r from-[#A59D84] to-[#C1BAA1] text-white hover:from-[#B5AD94] hover:to-[#D1CAB1]'
                      }`}
                    >
                      <ExternalLink className="w-6 h-6" />
                      Walrus Linkine Git
                    </motion.button>

                    {/* Like Button */}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleLike(selectedDoc.id)}
                      className={`flex items-center justify-center gap-3 py-4 px-6 rounded-xl text-lg font-semibold shadow-lg ${
                        isDark 
                          ? 'bg-[#F25912] text-white hover:bg-[#F25912]/80' 
                          : 'bg-[#C1BAA1] text-white hover:bg-[#C1BAA1]/80'
                      }`}
                    >
                      <Heart className="w-6 h-6" />
                      {selectedDoc.likes}
                    </motion.button>
                  </div>

                  {/* Info Text */}
                  <p className={`text-xs text-center ${isDark ? 'text-slate-500' : 'text-[#A59D84]/60'}`}>
                    Walrus linkine tıkladığınızda dosya içeriğini görüntüleyebilirsiniz. 
                    Beğeni butonu Sui blockchain&apos;e sinyal gönderir.
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
