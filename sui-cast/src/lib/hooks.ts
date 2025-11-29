import { useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { useState, useCallback } from "react";
import {
  createStudentProfile,
  uploadDocument,
  voteDocument,
  addAchievementToProfile,
  mintMonthlyAchievement,
  mintUploaderAchievement,
  mintPopularDocumentAchievement,
  PACKAGE_ID,
  DOCUMENT_LIBRARY_ID,
} from "./contracts";
import type { Document, StudentProfile } from "./contracts";

// ==================== TRANSACTION HOOKS ====================

/**
 * Öğrenci profili oluşturma hook'u
 */
export function useCreateStudentProfile() {
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const execute = useCallback(async () => {
    const tx = createStudentProfile();
    const result = await signAndExecute({
      transaction: tx,
    });
    return result;
  }, [signAndExecute]);

  return { execute, isPending };
}

/**
 * Döküman yükleme hook'u
 */
export function useUploadDocument() {
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const execute = useCallback(
    async (
      profileId: string,
      title: string,
      description: string,
      walrusBlobId: string,
      category: string
    ) => {
      const tx = uploadDocument(profileId, title, description, walrusBlobId, category);
      const result = await signAndExecute({
        transaction: tx,
      });
      return result;
    },
    [signAndExecute]
  );

  return { execute, isPending };
}

/**
 * Döküman oylama hook'u
 */
export function useVoteDocument() {
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const execute = useCallback(
    async (documentId: string) => {
      const tx = voteDocument(documentId);
      const result = await signAndExecute({
        transaction: tx,
      });
      return result;
    },
    [signAndExecute]
  );

  return { execute, isPending };
}

/**
 * Achievement ekleme hook'u
 */
export function useAddAchievementToProfile() {
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const execute = useCallback(
    async (profileId: string, achievementId: string) => {
      const tx = addAchievementToProfile(profileId, achievementId);
      const result = await signAndExecute({
        transaction: tx,
      });
      return result;
    },
    [signAndExecute]
  );

  return { execute, isPending };
}

// ==================== ADMIN HOOKS (NFT Minting) ====================

export function useMintMonthlyAchievement() {
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const execute = useCallback(
    async (recipient: string, rank: number, month: number) => {
      const tx = mintMonthlyAchievement(recipient, rank, month);
      const result = await signAndExecute({
        transaction: tx,
      });
      return result;
    },
    [signAndExecute]
  );

  return { execute, isPending };
}

export function useMintUploaderAchievement() {
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const execute = useCallback(
    async (recipient: string, uploadsCount: number, month: number) => {
      const tx = mintUploaderAchievement(recipient, uploadsCount, month);
      const result = await signAndExecute({
        transaction: tx,
      });
      return result;
    },
    [signAndExecute]
  );

  return { execute, isPending };
}

export function useMintPopularDocumentAchievement() {
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const execute = useCallback(
    async (recipient: string, votesReceived: number, month: number) => {
      const tx = mintPopularDocumentAchievement(recipient, votesReceived, month);
      const result = await signAndExecute({
        transaction: tx,
      });
      return result;
    },
    [signAndExecute]
  );

  return { execute, isPending };
}

// ==================== QUERY HOOKS ====================

/**
 * Kullanıcının StudentProfile'ını getirir
 */
export function useStudentProfile(address: string | undefined) {
  const client = useSuiClient();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const objects = await client.getOwnedObjects({
        owner: address,
        filter: {
          StructType: `${PACKAGE_ID}::document_system::StudentProfile`,
        },
        options: {
          showContent: true,
        },
      });

      if (objects.data.length > 0 && objects.data[0].data?.content?.dataType === "moveObject") {
        const fields = objects.data[0].data.content.fields as any;
        setProfile({
          id: objects.data[0].data.objectId,
          studentAddress: fields.student_address,
          totalUploads: Number(fields.total_uploads),
          totalVotesReceived: Number(fields.total_votes_received),
          achievements: fields.achievements || [],
        });
      } else {
        setProfile(null);
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [client, address]);

  return { profile, loading, error, refetch: fetch };
}

/**
 * Kütüphane istatistiklerini getirir
 */
export function useLibraryStats() {
  const client = useSuiClient();
  const [stats, setStats] = useState<{ totalDocuments: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    
    try {
      const object = await client.getObject({
        id: DOCUMENT_LIBRARY_ID,
        options: {
          showContent: true,
        },
      });

      if (object.data?.content?.dataType === "moveObject") {
        const fields = object.data.content.fields as any;
        setStats({
          totalDocuments: Number(fields.total_documents),
        });
      }
    } catch (err) {
      console.error("Error fetching library stats:", err);
    } finally {
      setLoading(false);
    }
  }, [client]);

  return { stats, loading, refetch: fetch };
}

/**
 * Document olaylarını dinleyerek dökümanları getirir
 */
export function useDocuments() {
  const client = useSuiClient();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    
    try {
      // DocumentUploaded eventlerini çek
      const events = await client.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::document_system::DocumentUploaded`,
        },
        limit: 50,
        order: "descending",
      });

      // DocumentLibrary'nin dynamic field'larını çek
      const dynamicFields = await client.getDynamicFields({
        parentId: DOCUMENT_LIBRARY_ID,
      });

      // Her dynamic field için içeriği çek
      const docsFromFields: Document[] = [];
      
      for (const field of dynamicFields.data) {
        try {
          const fieldObject = await client.getDynamicFieldObject({
            parentId: DOCUMENT_LIBRARY_ID,
            name: field.name,
          });
          
          if (fieldObject.data?.content?.dataType === "moveObject") {
            const fields = fieldObject.data.content.fields as any;
            
            // value içindeki fields'ı kontrol et (nested olabilir)
            const docFields = fields.value?.fields || fields.value || fields;
            
            docsFromFields.push({
              id: fieldObject.data.objectId,
              title: docFields.title || "",
              description: docFields.description || "",
              walrusBlobId: docFields.walrus_blob_id || docFields.blob_id || "",
              uploader: docFields.uploader || docFields.owner || "",
              uploadTimestamp: Number(docFields.upload_timestamp || docFields.timestamp || 0),
              votes: Number(docFields.votes || 0),
              category: docFields.category || "",
            });
          }
        } catch (err) {
          console.warn('Could not fetch dynamic field:', field.name);
        }
      }

      // Eğer dynamic field'lardan document gelmediyse, event'lerden oluştur
      if (docsFromFields.length > 0) {
        setDocuments(docsFromFields);
      } else {
        // Fallback: Event'lerden oluştur (walrusBlobId event'te yok - Move contract güncellemesi gerekli)
        const docsFromEvents: Document[] = events.data.map((event) => {
          const parsedJson = event.parsedJson as any;
          return {
            id: parsedJson.document_id,
            title: parsedJson.title || "",
            description: parsedJson.description || "",
            walrusBlobId: parsedJson.walrus_blob_id || "",
            uploader: parsedJson.uploader,
            uploadTimestamp: Number(parsedJson.timestamp || 0),
            votes: 0,
            category: parsedJson.category || "",
          };
        });
        setDocuments(docsFromEvents);
      }
    } catch (err) {
      console.error("Error fetching documents:", err);
    } finally {
      setLoading(false);
    }
  }, [client]);

  return { documents, loading, refetch: fetch };
}

/**
 * Kullanıcının achievement NFT'lerini getirir
 */
export function useAchievements(address: string | undefined) {
  const client = useSuiClient();
  const [achievements, setAchievements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!address) return;
    
    setLoading(true);
    
    try {
      const objects = await client.getOwnedObjects({
        owner: address,
        filter: {
          StructType: `${PACKAGE_ID}::achievement_nft::AchievementNFT`,
        },
        options: {
          showContent: true,
          showDisplay: true,
        },
      });

      const nfts = objects.data.map((obj) => {
        if (obj.data?.content?.dataType === "moveObject") {
          const fields = obj.data.content.fields as any;
          return {
            id: obj.data.objectId,
            name: fields.name,
            description: fields.description,
            imageUrl: fields.image_url,
            achievementType: Number(fields.achievement_type),
            month: Number(fields.month),
            rank: Number(fields.rank),
            recipient: fields.recipient,
            pointsEarned: Number(fields.points_earned),
          };
        }
        return null;
      }).filter(Boolean);

      setAchievements(nfts);
    } catch (err) {
      console.error("Error fetching achievements:", err);
    } finally {
      setLoading(false);
    }
  }, [client, address]);

  return { achievements, loading, refetch: fetch };
}
