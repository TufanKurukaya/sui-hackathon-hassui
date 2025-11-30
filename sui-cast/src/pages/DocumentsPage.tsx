import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../components/Toast';
import { Search, Upload, FileText, Heart, Trophy, Medal, Award, Moon, Sun, User, X, ExternalLink, Loader2, LogOut, CloudUpload, CheckCircle, AlertCircle, Radio, Bell, BellRing } from 'lucide-react';
import { useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import {
  useCreateStudentProfile,
  useUploadDocument,
  useVoteDocument,
  useStudentProfile,
  useLibraryStats,
  useDocuments,
} from '../lib/hooks';
import {
  useDocumentEventStream,
  isSurfluxConfigured,
  type DocumentUploadedEvent,
  type DocumentVotedEvent,
  type ParsedDocumentEvent,
} from '../lib/surflux';

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
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    walrusBlobId: '',
    category: '',
  });
  // Report popup state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportBlobId, setReportBlobId] = useState("");
  const [reportTargetId, setReportTargetId] = useState("");
  
  // Surflux Real-time Stream State
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);
  const [newDocNotification, setNewDocNotification] = useState<string | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);

  
  // Walrus upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [walrusUploading, setWalrusUploading] = useState(false);
  const [walrusUploadStatus, setWalrusUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [walrusError, setWalrusError] = useState<string | null>(null);
  
  const isDark = theme === 'dark';

  // Sui Hooks - Wallet connection
  const account = useCurrentAccount();
  const walletAddress = account?.address;
  
  // Get zkLogin address from sessionStorage
  const [zkLoginAddress, setZkLoginAddress] = useState<string | null>(null);
  const [zkLoginUserInfo, setZkLoginUserInfo] = useState<{
    email?: string;
    name?: string;
    picture?: string;
  } | null>(null);
  
  // Active address: wallet first, then zkLogin
  const address = walletAddress || zkLoginAddress;
  
  // Load zkLogin info
  useEffect(() => {
    const storedAddress = sessionStorage.getItem('zklogin_address');
    const storedUserInfo = sessionStorage.getItem('zklogin_user_info');
    
    if (storedAddress) {
      setZkLoginAddress(storedAddress);
    }
    if (storedUserInfo) {
      try {
        setZkLoginUserInfo(JSON.parse(storedUserInfo));
      } catch (e) {
        console.error('zkLogin user info parse error:', e);
      }
    }
  }, []);

  const { execute: createProfile, isPending: isCreatingProfile } = useCreateStudentProfile();
  const { execute: uploadDoc, isPending: isUploading } = useUploadDocument();
  const { execute: vote, isPending: isVoting } = useVoteDocument();

  const { profile, loading: profileLoading, refetch: refetchProfile } = useStudentProfile(address || undefined);
  const { stats, refetch: refetchStats } = useLibraryStats();
  const { documents: blockchainDocs, loading: docsLoading, refetch: refetchDocuments } = useDocuments();
  
  // ==================== SURFLUX REAL-TIME STREAM ====================
  
  // Called when a new document is uploaded
  const handleDocumentUploaded = useCallback((event: DocumentUploadedEvent) => {
    
    // Show notification
    setNewDocNotification(`📄 New document: "${event.title}"`);
    
    // Close notification after 5 seconds
    setTimeout(() => setNewDocNotification(null), 5000);
    
    // Refresh document list
    refetchDocuments();
    
    // Increase notification count
    setNotificationCount(prev => prev + 1);
  }, [refetchDocuments]);

  // Called when a document is voted
  const handleDocumentVoted = useCallback((event: DocumentVotedEvent) => {
    
    // Refresh document list (for new vote count)
    refetchDocuments();
    
    // Increase notification count
    setNotificationCount(prev => prev + 1);
  }, [refetchDocuments]);

  // Surflux real-time stream hook
  const { 
    status: streamStatus, 
    isConnected: isStreamConnected,
    recentEvents,
  } = useDocumentEventStream({
    onDocumentUploaded: handleDocumentUploaded,
    onDocumentVoted: handleDocumentVoted,
    enabled: realtimeEnabled && isSurfluxConfigured(),
  });

  // Fetch data on initial load
  useEffect(() => {
    if (address) {
      refetchProfile();
    }
    refetchStats();
    refetchDocuments();
  }, [address]);

  const navigate = useNavigate();
  const { mutate: disconnectWallet } = useDisconnectWallet();

  // Logout
  const handleLogout = () => {
    // Disconnect if wallet is connected
    if (walletAddress) {
      disconnectWallet();
    }
    // Set logout flag (prevent autoConnect on page refresh)
    localStorage.setItem('wallet_logged_out', 'true');
    // Clear zkLogin data
    sessionStorage.removeItem('zklogin_address');
    sessionStorage.removeItem('zklogin_user_info');
    sessionStorage.removeItem('zklogin_ephemeral_data');
    sessionStorage.removeItem('sui_jwt_token');
    // Clear states
    setZkLoginAddress(null);
    setZkLoginUserInfo(null);
    // Redirect to home page
    navigate('/');
  };

  // Create profile
  const handleCreateProfile = async () => {
    try {
      await createProfile();
      setTimeout(() => refetchProfile(), 2000);
    } catch (error) {
      console.error('Profile creation error:', error);
    }
  };

  // Upload file to Walrus
  const uploadToWalrus = async (file: File): Promise<string> => {
    setWalrusUploading(true);
    setWalrusUploadStatus('uploading');
    setWalrusError(null);

    // Try multiple proxy endpoints (different Walrus publishers)
    const PROXY_ENDPOINTS = [
      '/walrus-api',    // https://publisher.walrus-testnet.walrus.space
      '/walrus-api-2',  // https://wal-publisher-testnet.staketab.org
      '/walrus-api-3',  // https://walrus-testnet-publisher.nodes.guru
      '/walrus-api-4',  // https://testnet-publisher.walrus.graphyte.dev
    ];



    let lastError: Error | null = null;

    for (const proxyEndpoint of PROXY_ENDPOINTS) {
      try {
        
        const response = await fetch(`${proxyEndpoint}/v1/blobs?epochs=5`, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: file,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`${proxyEndpoint} failed: ${response.status} - ${errorText}`);
          lastError = new Error(`HTTP ${response.status}: ${errorText}`);
          continue;
        }

        const result = await response.json();
        
        // Response structure: { newlyCreated: { blobObject: { blobId: "..." } } } 
        // or { alreadyCertified: { blobId: "..." } }
        const blobId = result.newlyCreated?.blobObject?.blobId || 
                       result.alreadyCertified?.blobId ||
                       result.blobId;
        
        
        if (!blobId) {
          console.warn('Blob ID not found:', result);
          lastError = new Error('Blob ID could not be retrieved');
          continue;
        }

        // Success! Update states
        setWalrusUploading(false);
        setWalrusUploadStatus('success');
        setUploadForm(prev => ({ ...prev, walrusBlobId: blobId }));
        return blobId;
      } catch (err) {
        console.warn(`${proxyEndpoint} error:`, err);
        lastError = err instanceof Error ? err : new Error(String(err));
        continue;
      }
    }

    // If all endpoints failed
    console.error('Walrus upload error - all publishers failed:', lastError);
    setWalrusUploading(false);
    setWalrusUploadStatus('error');
    setWalrusError(lastError?.message || 'All Walrus publishers failed');
    throw lastError || new Error('Walrus upload failed');
  };

  // When file is selected
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    
    // Automatically upload to Walrus
    try {
      await uploadToWalrus(file);
    } catch {
      // Error is already in state
    }
  };

  // Upload document (save to blockchain)
  const handleUploadDocument = async () => {
    if (!profile) {
      showToast('You must create a profile first!', 'warning');
      return;
    }

    if (!uploadForm.walrusBlobId) {
      showToast('Please upload a file first!', 'warning');
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
      // Reset form
      setUploadForm({ title: '', description: '', walrusBlobId: '', category: '' });
      setSelectedFile(null);
      setWalrusUploadStatus('idle');
      setShowUploadModal(false);
      setTimeout(() => {
        refetchProfile();
        refetchDocuments();
      }, 2000);
    } catch (error) {
      console.error('Document upload error:', error);
    }
  };

  // Convert documents from blockchain to Document type
  // Use mock data if no data from blockchain
  const mockDocuments: Document[] = [
    { 
      id: '1', 
      title: 'Push_Swap', 
      author: '0x12...ab', 
      likes: 124, 
      blobId: 'blob123', 
      description: 'This project involves a sorting algorithm using two stacks.' 
    },
    { 
      id: '2', 
      title: 'Philosophers', 
      author: '0x34...cd', 
      likes: 98, 
      blobId: 'blob456', 
      description: 'A project involving thread and mutex usage on the classic dining philosophers problem.' 
    },
    { 
      id: '3', 
      title: 'Minishell', 
      author: '0x56...ef', 
      likes: 156, 
      blobId: 'blob789', 
      description: 'A bash-like shell application. Includes pipes, redirection, environment variables.' 
    },
    { 
      id: '4', 
      title: 'Cub3D', 
      author: '0x78...gh', 
      likes: 87, 
      blobId: 'blob012', 
      description: 'A 3D maze game made using raycasting technique.' 
    },
    
  ];

  // Convert blockchain documents to UI format
  const documents: Document[] = blockchainDocs.length > 0 
    ? blockchainDocs.map(doc => ({
        id: doc.id,
        title: doc.title,
        author: `${doc.uploader.slice(0, 6)}...${doc.uploader.slice(-4)}`,
        likes: doc.votes,
        blobId: doc.walrusBlobId,
        description: doc.description || 'No description',
        category: doc.category,
      }))
    : mockDocuments;

  // Leaderboard: Most liked documents (top 5)
  const leaderboard: LeaderboardUser[] = [...documents]
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 5)
    .map((doc, index) => ({
      rank: index + 1,
      address: doc.title,
      points: doc.likes,
    }));

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
  // handle report function
  const handleReport = (docId: string) => {
    setReportTargetId(docId);   // which document is being reported?
    setShowReportModal(true);   // open popup
  };
  const handleSubmitReport = () => {
    if (!reportBlobId.trim()) {
      showToast("Please enter a Blob ID.", 'warning');
      return;
    }
  
    console.log("Report sent:", {
      documentId: reportTargetId,
      blobId: reportBlobId,
    });
  
    showToast("Report successfully sent!", 'success');
  
    setReportBlobId("");
    setShowReportModal(false);
  };
  

  // Send vote to blockchain
  const handleLike = async (docId: string) => {
    if (!address) {
      showToast('Please connect your wallet!', 'warning');
      return;
    }

    // Do not send real vote if mock document
    if (docId.length < 10) {
      return;
    }

    try {
      await vote(docId);
      // Wait a bit and refetch
      setTimeout(() => {
        refetchDocuments();
      }, 3000);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('E_ALREADY_VOTED') || errorMessage.includes('0')) {
        showToast('You have already voted for this document!', 'error');
      } else if (errorMessage.includes('E_CANNOT_VOTE_OWN_DOCUMENT') || errorMessage.includes('1')) {
        showToast('You cannot vote for your own document!', 'error');
      } else {
        console.error('Voting error:', error);
      }
    }
  };

  const openWalrusLink = (blobId: string) => {
    // Walrus Aggregator URL
    const walrusUrl = `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`;
    
    // Open URL directly - browser will download the file
    // User should change the extension of the downloaded file to .pdf
    window.open(walrusUrl, '_blank');
  };
  
  // Function to fetch file and download with correct name
  const downloadWalrusFile = async (blobId: string, filename: string) => {
    try {
      const walrusUrl = `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`;
      
      const response = await fetch(walrusUrl);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      
      // Add extension to filename (if missing)
      let finalFilename = filename;
      if (!filename.includes('.')) {
        finalFilename = `${filename}.pdf`; // Default to PDF
      }
      
      // Download file
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
      showToast('File could not be downloaded. Please try again.', 'error');
    }
  };

  // Search filtering
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
          🏆 Top Documents
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
                  <p className={`text-xs font-medium truncate ${isDark ? 'text-slate-200' : 'text-[#A59D84]'}`}>
                    {user.address}
                  </p>
                  <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-[#A59D84]/70'}`}>
                    ❤️ {user.points} likes
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
            Total Documents
          </p>
          <p className={`text-2xl font-bold ${isDark ? 'text-[#F25912]' : 'text-[#A59D84]'}`}>
            {stats?.totalDocuments || documents.length}
          </p>
        </div>

        {/* zkLogin User Info */}
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

        {/* Profile Status */}
        {address && (
          <div className={`mt-3 p-3 rounded-lg border ${
            isDark ? 'border-[#5C3E94]/30 bg-[#412B6B]/30' : 'border-[#A59D84]/30 bg-[#ECEBDE]/50'
          }`}>
            {profileLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className={`w-4 h-4 animate-spin ${isDark ? 'text-slate-400' : 'text-[#A59D84]'}`} />
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-[#A59D84]'}`}>Loading...</span>
              </div>
            ) : profile ? (
              <div>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-[#A59D84]'}`}>My Profile</p>
                <p className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {profile.totalUploads} uploads
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
                {isCreatingProfile ? 'Creating...' : zkLoginAddress && !walletAddress ? 'Connect Wallet (for zkLogin profile)' : 'Create Profile'}
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

          {/* Surflux Real-time Notification Bell */}
          {isSurfluxConfigured() && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="relative"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`h-16 w-16 flex items-center justify-center rounded-2xl border-2 cursor-pointer relative ${
                  isDark 
                    ? 'border-[#5C3E94] bg-[#412B6B] hover:bg-[#5C3E94]' 
                    : 'border-[#A59D84] bg-[#D7D3BF] hover:bg-[#C1BAA1]'
                }`}
                onClick={() => {
                  setShowNotificationDropdown(!showNotificationDropdown);
                  if (notificationCount > 0) {
                    setNotificationCount(0);
                  }
                }}
                title={isStreamConnected ? 'Notifications (Connected)' : 'Notifications (Connecting...)'}
              >
                {notificationCount > 0 ? (
                  <BellRing className={`w-6 h-6 ${isDark ? 'text-[#F25912]' : 'text-[#A59D84]'} animate-pulse`} />
                ) : (
                  <Bell className={`w-6 h-6 ${isDark ? 'text-slate-300' : 'text-slate-700'}`} />
                )}
                
                {/* Notification Badge */}
                {notificationCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
                  >
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </motion.span>
                )}
                
                {/* Connection Status Dot */}
                <span className={`absolute bottom-2 right-2 w-2 h-2 rounded-full ${
                  isStreamConnected ? 'bg-green-500' : 
                  streamStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-400'
                }`} />
              </motion.button>
              
              {/* Notification Dropdown */}
              <AnimatePresence>
                {showNotificationDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className={`absolute top-20 right-0 w-72 max-h-80 overflow-y-auto rounded-xl border-2 shadow-2xl z-50 ${
                      isDark 
                        ? 'bg-[#2d1f45] border-[#5C3E94]' 
                        : 'bg-white border-[#C1BAA1]'
                    }`}
                  >
                    <div className={`p-3 border-b ${
                      isDark ? 'border-[#5C3E94]' : 'border-[#C1BAA1]'
                    }`}>
                      <div className="flex items-center justify-between">
                        <h3 className={`font-semibold ${
                          isDark ? 'text-slate-200' : 'text-slate-800'
                        }`}>Notifications</h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          isStreamConnected 
                            ? 'bg-green-500/20 text-green-500' 
                            : 'bg-yellow-500/20 text-yellow-500'
                        }`}>
                          {isStreamConnected ? '● Live' : '○ Connecting'}
                        </span>
                      </div>
                    </div>
                    
                    {recentEvents.length === 0 ? (
                      <div className={`p-6 text-center ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No notifications yet</p>
                        <p className="text-xs mt-1">New documents will appear here</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-opacity-20">
                        {recentEvents.slice(0, 10).map((event, index) => (
                          <div
                            key={`${event.txHash}-${index}`}
                            className={`p-3 hover:bg-opacity-50 transition-colors ${
                              isDark ? 'hover:bg-[#412B6B]' : 'hover:bg-[#ECEBDE]'
                            }`}
                          >
                            {event.eventType === 'DocumentUploaded' ? (
                              <div className="flex items-start gap-2">
                                <FileText className={`w-4 h-4 mt-0.5 ${
                                  isDark ? 'text-green-400' : 'text-green-600'
                                }`} />
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium truncate ${
                                    isDark ? 'text-slate-200' : 'text-slate-800'
                                  }`}>
                                    {(event.data as DocumentUploadedEvent).title}
                                  </p>
                                  <p className={`text-xs ${
                                    isDark ? 'text-slate-400' : 'text-slate-500'
                                  }`}>
                                    New document uploaded
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2">
                                <Heart className={`w-4 h-4 mt-0.5 ${
                                  isDark ? 'text-red-400' : 'text-red-500'
                                }`} />
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm ${
                                    isDark ? 'text-slate-200' : 'text-slate-800'
                                  }`}>
                                    New vote: {(event.data as DocumentVotedEvent).new_vote_count} likes
                                  </p>
                                  <p className={`text-xs truncate ${
                                    isDark ? 'text-slate-400' : 'text-slate-500'
                                  }`}>
                                    {(event.data as DocumentVotedEvent).document_id.slice(0, 20)}...
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Upload Button */}
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (!profile) {
                showToast('You must create a profile from the left panel first!', 'warning');
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
              title="Logout"
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

        {/* Real-time Notification Banner */}
        <AnimatePresence>
          {newDocNotification && (
            <motion.div
              initial={{ opacity: 0, y: -20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -20, height: 0 }}
              className={`mx-6 mb-2 px-4 py-3 rounded-xl flex items-center gap-3 ${
                isDark 
                  ? 'bg-green-900/30 border border-green-500/30 text-green-400' 
                  : 'bg-green-100 border border-green-300 text-green-700'
              }`}
            >
              <Radio className="w-5 h-5 animate-pulse" />
              <span className="flex-1 text-sm font-medium">{newDocNotification}</span>
              <button 
                onClick={() => setNewDocNotification(null)}
                className="hover:opacity-70"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

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
                  Author: {doc.author}
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
                  {isVoting ? '...' : `LIKE (${doc.likes})`}
                </motion.button>

                <p className={`text-[10px] mt-2 text-center ${isDark ? 'text-slate-500' : 'text-[#A59D84]/60'}`}>
                  Click to view details
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
                        Author: {selectedDoc.author}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Modal Body */}
                <div className="p-8 space-y-6">
                  {/* Açıklama */}
                  <div>
                    <h3 className={`text-xl font-semibold mb-3 ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                      Project Description
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
                      onClick={() => openWalrusLink(selectedDoc.blobId)}
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
                        {!selectedDoc.blobId.startsWith('blob') ? 'Download (.pdf)' : 'Not Downloadable'}
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
                      ? 'This is sample data. Upload a new document to see a real file.'
                      : 'Use buttons to view or download the file. Like button sends a signal to Sui blockchain.'
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
              className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-8 overflow-y-auto"
            >
              <div
                className={`relative w-full max-w-lg my-4 sm:my-0 rounded-2xl shadow-2xl border-2 ${
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
                  className={`absolute top-4 right-4 z-50 p-2 rounded-full ${
                    isDark 
                      ? 'bg-[#5C3E94] hover:bg-[#F25912]' 
                      : 'bg-[#A59D84] hover:bg-[#C1BAA1]'
                  }`}
                >
                  <X className="w-5 h-5 text-white" />
                </motion.button>

                {/* Modal Header */}
                <div className={`p-4 sm:p-6 border-b rounded-t-2xl ${isDark ? 'border-[#5C3E94]/30 bg-[#412B6B]' : 'border-[#C1BAA1]/30 bg-white'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${
                      isDark ? 'bg-[#5C3E94]/30' : 'bg-[#A59D84]/20'
                    }`}>
                      <Upload className={`w-5 h-5 sm:w-6 sm:h-6 ${isDark ? 'text-[#F25912]' : 'text-[#A59D84]'}`} />
                    </div>
                    <h2 className={`text-xl sm:text-2xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                      Upload New Document
                    </h2>
                  </div>
                </div>

                {/* Modal Body */}
                <div className="p-4 sm:p-6 space-y-4 max-h-[60vh] sm:max-h-[70vh] overflow-y-auto">
                  {/* Dosya Yükleme Alanı */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Select File (will be uploaded to Walrus)
                    </label>
                    <div
                      className={`relative border-2 border-dashed rounded-xl p-4 sm:p-6 text-center transition-all ${
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
                            Uploading to Walrus...
                          </p>
                        </div>
                      ) : walrusUploadStatus === 'success' ? (
                        <div className="flex flex-col items-center gap-2">
                          <CheckCircle className="w-8 h-8 text-green-500" />
                          <p className={`text-sm font-medium ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                            {selectedFile?.name} uploaded!
                          </p>
                          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Click to select another file
                          </p>
                        </div>
                      ) : walrusUploadStatus === 'error' ? (
                        <div className="flex flex-col items-center gap-2">
                          <AlertCircle className="w-8 h-8 text-red-500" />
                          <p className={`text-sm font-medium ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                            Upload failed!
                          </p>
                          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {walrusError || 'Try again'}
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <CloudUpload className={`w-8 h-8 ${isDark ? 'text-[#F25912]' : 'text-[#A59D84]'}`} />
                          <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                            Click or drag to select file
                          </p>
                          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            PDF, DOC, DOCX, TXT, MD supported
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
                      Title
                    </label>
                    <input
                      type="text"
                      value={uploadForm.title}
                      onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                      placeholder="Document title"
                      className={`w-full p-3 rounded-lg border outline-none ${
                        isDark 
                          ? 'bg-[#2d1f45] border-[#5C3E94]/40 text-slate-100 placeholder-slate-500 focus:border-[#F25912]' 
                          : 'bg-white border-[#C1BAA1]/40 text-slate-900 placeholder-[#A59D84] focus:border-[#A59D84]'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Description
                    </label>
                    <textarea
                      value={uploadForm.description}
                      onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                      placeholder="Document description"
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
                      Category
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
                      <option value="">Select category</option>
                      <option value="42 Project">42 Project</option>
                      <option value="Programming">Programming</option>
                      <option value="Mathematics">Mathematics</option>
                      <option value="Physics">Physics</option>
                      <option value="Blockchain">Blockchain</option>
                      <option value="Other">Other</option>
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
                        Saving to blockchain...
                      </span>
                    ) : (
                      'Save Document'
                    )}
                  </motion.button>

                  <p className={`text-xs text-center ${isDark ? 'text-slate-500' : 'text-[#A59D84]/60'}`}>
                    File is saved to Walrus, info to Sui blockchain.
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* REPORT MODAL */}
<AnimatePresence>
  {showReportModal && (
    <>
      <motion.div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      <motion.div
        className="fixed inset-0 z-[1000] flex items-center justify-center p-6"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
      >
        <div
          className={`relative w-full max-w-md rounded-2xl p-6 border-2 shadow-xl ${
            isDark ? 'bg-[#412B6B] border-[#5C3E94]' : 'bg-white border-[#A59D84]'
          }`}
        >
          {/* Close Button */}
          <button
            onClick={() => setShowReportModal(false)}
            className={`absolute top-4 right-4 p-2 rounded-full transition-colors ${
              isDark 
                ? 'bg-[#5C3E94] hover:bg-[#F25912] text-white' 
                : 'bg-[#A59D84] hover:bg-[#C1BAA1] text-white'
            }`}
          >
            <X className="w-5 h-5" />
          </button>

          <h2 className={`text-2xl font-bold mb-4 text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Report Document
          </h2>

          <label className={`font-semibold mb-1 block ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            Blob ID:
          </label>
          <input
            type="text"
            value={reportBlobId}
            onChange={(e) => setReportBlobId(e.target.value)}
            placeholder="e.g.: 0xabc123..."
            className={`w-full p-3 rounded-lg border-2 mb-6 ${
              isDark
                ? "bg-[#2d1f45] border-[#5C3E94] text-white"
                : "bg-white border-[#A59D84] text-black"
            }`}
          />

          <div className="flex justify-end gap-4">
            <button
              onClick={() => setShowReportModal(false)}
              className={`px-4 py-2 rounded-lg border-2 font-semibold ${
                isDark ? "border-[#5C3E94] text-white" : "border-[#A59D84] text-black"
              }`}
            >
              Cancel
            </button>

            <button
              onClick={handleSubmitReport}
              className="px-4 py-2 rounded-lg font-semibold bg-red-600 text-white hover:bg-red-500"
            >
              Send
            </button>
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
