import { useFirebase } from '../composables/useFirebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

export class OrgChartAuthService {
  /**
   * Create a temporary secret code in Firebase Firestore
   * Matches Angular implementation: tempCodes/server/userCodes collection
   * Returns the document reference ID to use as keyDocRefId
   */
  async createSecretCode(communityId: number, slackUserId: string): Promise<string> {
    try {
      const { firestore } = useFirebase();
      if (!firestore) {
        throw new Error('Firestore not available');
      }

      // Match Angular structure: tempCodes/server/userCodes
      const userCodesRef = collection(firestore, 'tempCodes/server/userCodes');
      
      // Create document with createdAt, communityId, and slackUserId
      // The document ID (returned by addDoc) becomes the keyDocRefId
      const docRef = await addDoc(userCodesRef, {
        createdAt: Timestamp.now(),
        communityId,
        slackUserId,
      });

      console.log('[OrgChartAuthService] Created Firebase document with ID:', docRef.id);
      
      // Return the document ID (this becomes keyDocRefId)
      return docRef.id;
    } catch (error) {
      console.error('[OrgChartAuthService] Failed to create secret code:', error);
      throw error;
    }
  }

  /**
   * Note: Validation is done by the backend
   * The backend reads the Firestore document using keyDocRefId and validates:
   * - Document exists
   * - createdAt is recent (< 3 seconds old)
   * - communityId and slackUserId match
   */
}

export const orgChartAuthService = new OrgChartAuthService();

