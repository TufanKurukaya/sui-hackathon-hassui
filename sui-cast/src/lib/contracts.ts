import { Transaction } from "@mysten/sui/transactions";

// ==================== CONTRACT CONSTANTS ====================
export const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID || "0xbfaff760182ed4b267cbf6db6ceaa28012b2adb48a2e2db0c51023efa2f1fda7";
export const DOCUMENT_LIBRARY_ID = import.meta.env.VITE_DOCUMENT_LIBRARY_ID || "0xd4a75ba83ee878c99fcdbf493e4211316dc6d62492dd23ee7416135fabb1e793";
export const ACHIEVEMENT_MINTER_ID = import.meta.env.VITE_ACHIEVEMENT_MINTER_ID || "0xf9799f420495793f17e33e3efefef4bae0d511f482e5b5eec8795322048f9496";
export const CLOCK_ID = "0x6"; // Sui system clock object

// ==================== DOCUMENT SYSTEM PTBs ====================

/**
 * Creates a new student profile
 * Every user must call this before using the system
 */
export function createStudentProfile(): Transaction {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::document_system::create_student_profile`,
  });
  
  return tx;
}

/**
 * Uploads a document
 * @param profileId - User's StudentProfile object ID
 * @param title - Document title
 * @param description - Document description
 * @param walrusBlobId - Blob ID of the document uploaded to Walrus
 * @param category - Document category (e.g., "Mathematics", "Physics")
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
 * Votes for a document
 * @param documentId - ID of the document to vote for
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
 * Adds achievement NFT to profile
 * @param profileId - User's StudentProfile object ID
 * @param achievementId - ID of the achievement NFT to add
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
 * Updates monthly leaderboard
 * @param month - Month (timestamp_ms / 2592000000)
 * @param topStudents - Addresses of top students
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
 * Mints monthly achievement NFT (Admin only)
 * @param recipient - NFT recipient address
 * @param rank - Rank (1, 2 or 3)
 * @param month - Month
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
 * Mints achievement NFT for top uploader (Admin only)
 * @param recipient - NFT recipient address
 * @param uploadsCount - Upload count
 * @param month - Month
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
 * Mints achievement NFT for popular document (Admin only)
 * @param recipient - NFT recipient address
 * @param votesReceived - Number of votes received
 * @param month - Month
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
