import { Transaction } from "@mysten/sui/transactions";

// ==================== CONTRACT CONSTANTS ====================
export const PACKAGE_ID = import.meta.env.PACKAGE_ID || "0x858c64e2d03c5a026d9e8edd42ea180b0266582bd690d31c45ac6c2a89b83da0";
export const DOCUMENT_LIBRARY_ID = import.meta.env.DOCUMENT_LIBRARY_ID || "0x6b9897ab619db2f3502e393f85fd14d9650530bba6a5de595aecb2ac70c785b7";
export const ACHIEVEMENT_MINTER_ID = import.meta.env.ACHIEVEMENT_MINTER_ID || "0x175b8a52894ee47017a2ad3b5e6537ec3302a29117c2c02d9bbc58a0a9c43e17";
export const CLOCK_ID = "0x6"; // Sui sistem clock objesi

// ==================== DOCUMENT SYSTEM PTBs ====================

/**
 * Yeni öğrenci profili oluşturur
 * Her kullanıcı sistemi kullanmadan önce bunu çağırmalı
 */
export function createStudentProfile(): Transaction {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::document_system::create_student_profile`,
  });
  
  return tx;
}

/**
 * Döküman yükler
 * @param profileId - Kullanıcının StudentProfile object ID'si
 * @param title - Döküman başlığı
 * @param description - Döküman açıklaması
 * @param walrusBlobId - Walrus'a yüklenen dökümanın blob ID'si
 * @param category - Döküman kategorisi (örn: "Matematik", "Fizik")
 */
export function uploadDocument(
  profileId: string,
  title: string,
  description: string,
  walrusBlobId: string,
  category: string
): Transaction {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::document_system::upload_document`,
    arguments: [
      tx.object(DOCUMENT_LIBRARY_ID),  // DocumentLibrary shared object
      tx.object(profileId),             // StudentProfile
      tx.pure.string(title),
      tx.pure.string(description),
      tx.pure.string(walrusBlobId),
      tx.pure.string(category),
      tx.object(CLOCK_ID),              // Clock
    ],
  });
  
  return tx;
}

/**
 * Dökümana oy verir
 * @param documentId - Oy verilecek dökümanın ID'si
 */
export function voteDocument(documentId: string): Transaction {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::document_system::vote_document`,
    arguments: [
      tx.object(DOCUMENT_LIBRARY_ID),  // DocumentLibrary shared object
      tx.pure.id(documentId),           // Document ID
      tx.object(CLOCK_ID),              // Clock
    ],
  });
  
  return tx;
}

/**
 * Profile'a achievement NFT ekler
 * @param profileId - Kullanıcının StudentProfile object ID'si
 * @param achievementId - Eklenecek achievement NFT'nin ID'si
 */
export function addAchievementToProfile(
  profileId: string,
  achievementId: string
): Transaction {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::document_system::add_achievement_to_profile`,
    arguments: [
      tx.object(profileId),
      tx.pure.id(achievementId),
    ],
  });
  
  return tx;
}

/**
 * Aylık liderlik tablosunu günceller
 * @param month - Ay (timestamp_ms / 2592000000)
 * @param topStudents - En iyi öğrencilerin adresleri
 */
export function updateMonthlyLeaderboard(
  month: number,
  topStudents: string[]
): Transaction {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::document_system::update_monthly_leaderboard`,
    arguments: [
      tx.object(DOCUMENT_LIBRARY_ID),
      tx.pure.u64(month),
      tx.pure.vector("address", topStudents),
    ],
  });
  
  return tx;
}

// ==================== ACHIEVEMENT NFT PTBs ====================

/**
 * Aylık başarı NFT'si mint eder (Sadece admin)
 * @param recipient - NFT alıcısının adresi
 * @param rank - Sıralama (1, 2 veya 3)
 * @param month - Ay
 */
export function mintMonthlyAchievement(
  recipient: string,
  rank: number,
  month: number
): Transaction {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::achievement_nft::mint_monthly_achievement`,
    arguments: [
      tx.object(ACHIEVEMENT_MINTER_ID),
      tx.pure.address(recipient),
      tx.pure.u8(rank),
      tx.pure.u64(month),
    ],
  });
  
  return tx;
}

/**
 * En çok yükleyen için başarı NFT'si mint eder (Sadece admin)
 * @param recipient - NFT alıcısının adresi
 * @param uploadsCount - Yükleme sayısı
 * @param month - Ay
 */
export function mintUploaderAchievement(
  recipient: string,
  uploadsCount: number,
  month: number
): Transaction {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::achievement_nft::mint_uploader_achievement`,
    arguments: [
      tx.object(ACHIEVEMENT_MINTER_ID),
      tx.pure.address(recipient),
      tx.pure.u64(uploadsCount),
      tx.pure.u64(month),
    ],
  });
  
  return tx;
}

/**
 * Popüler döküman için başarı NFT'si mint eder (Sadece admin)
 * @param recipient - NFT alıcısının adresi
 * @param votesReceived - Alınan oy sayısı
 * @param month - Ay
 */
export function mintPopularDocumentAchievement(
  recipient: string,
  votesReceived: number,
  month: number
): Transaction {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::achievement_nft::mint_popular_document_achievement`,
    arguments: [
      tx.object(ACHIEVEMENT_MINTER_ID),
      tx.pure.address(recipient),
      tx.pure.u64(votesReceived),
      tx.pure.u64(month),
    ],
  });
  
  return tx;
}

// ==================== HELPER TYPES ====================

export interface Document {
  id: string;
  title: string;
  description: string;
  walrusBlobId: string;
  uploader: string;
  uploadTimestamp: number;
  votes: number;
  category: string;
}

export interface StudentProfile {
  id: string;
  studentAddress: string;
  totalUploads: number;
  totalVotesReceived: number;
  achievements: string[];
}

export interface LeaderboardEntry {
  student: string;
  points: number;
}

export interface AchievementNFT {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  achievementType: number; // 1: Monthly, 2: Top Uploader, 3: Popular Document
  month: number;
  rank: number;
  recipient: string;
  pointsEarned: number;
}
