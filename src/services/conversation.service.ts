import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  addDoc,
  updateDoc,
  setDoc,
  Timestamp,
  collectionGroup,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { useFirebase } from '../composables/useFirebase';
import { useAuthStore } from '../stores/auth.store';
import type { FirebaseMessages, FirebaseMessage, UserFirebaseMessage } from '../models/conversation';

export class ConversationService {
  private firestore = useFirebase().firestore;

  /**
   * Get all Firebase conversations for a user
   */
  async getFirebaseConversationsByUserId(userId: number): Promise<Map<string, UserFirebaseMessage>> {
    if (!this.firestore) {
      throw new Error('Firestore not initialized');
    }

    const userMessagesRef = collection(this.firestore, `users/${userId}/messages`);
    
    try {
      const querySnapshot = await getDocs(userMessagesRef);
      const conversations = new Map<string, UserFirebaseMessage>();
      
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data() as UserFirebaseMessage;
        conversations.set(docSnap.id, {
          conversationId: data.conversationId,
          updatedAt: data.updatedAt,
          parentId: data.parentId,
          parentType: data.parentType,
        });
      });
      
      return conversations;
    } catch (error) {
      console.error('Error getting Firebase conversations:', error);
      return new Map();
    }
  }

  /**
   * Subscribe to real-time updates of user conversations
   */
  subscribeToUserConversations(
    userId: number,
    callback: (conversations: Map<string, UserFirebaseMessage>) => void
  ): () => void {
    if (!this.firestore) {
      console.error('Firestore not initialized');
      return () => {};
    }

    const userMessagesRef = collection(this.firestore, `users/${userId}/messages`);
    
    return onSnapshot(
      userMessagesRef,
      (querySnapshot) => {
        const conversations = new Map<string, UserFirebaseMessage>();
        
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data() as UserFirebaseMessage;
          conversations.set(docSnap.id, {
            conversationId: data.conversationId,
            updatedAt: data.updatedAt,
            parentId: data.parentId,
            parentType: data.parentType,
          });
        });
        
        callback(conversations);
      },
      (error) => {
        console.error('Error in conversations subscription:', error);
      }
    );
  }

  /**
   * Get Firebase conversations for a group
   * Queries messages collection where parentId == groupId AND parentType == 'groups'
   */
  async getFirebaseConversationsByGroupId(
    groupId: number,
    parentType: string = 'groups'
  ): Promise<FirebaseMessages[]> {
    if (!this.firestore) {
      throw new Error('Firestore not initialized');
    }

    try {
      const messagesRef = collection(this.firestore, 'messages');
      const q = query(
        messagesRef,
        where('parentId', '==', groupId),
        where('parentType', '==', parentType)
      );
      
      const querySnapshot = await getDocs(q);
      const conversations: FirebaseMessages[] = [];
      
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data() as FirebaseMessages;
        const { id: _ignoredId, conversationId: dataConversationId, ...rest } = data;
        conversations.push({
          id: docSnap.id,
          conversationId: dataConversationId || docSnap.id,
          ...rest,
        });
      });
      
      return conversations;
    } catch (error) {
      console.error('Error getting Firebase conversations by group ID:', error);
      return [];
    }
  }

  /**
   * Get a specific conversation by ID
   * Conversations are stored in 'messages' collection
   */
  async getConversationById(conversationId: string): Promise<FirebaseMessages | null> {
    if (!this.firestore) {
      throw new Error('Firestore not initialized');
    }

    try {
      const messagesRef = collection(this.firestore, 'messages');
      const conversationDoc = doc(messagesRef, conversationId);
      const docSnap = await getDoc(conversationDoc);
      
      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data() as FirebaseMessages;
      
      // Get messages for this conversation
      const messages = await this.getMessagesForConversation(conversationId);
      
      return {
        id: docSnap.id,
        conversationId: data.conversationId || conversationId,
        messages: messages,
        users: data.users || [],
        isTyping: data.isTyping || [],
        parentId: data.parentId || 0,
        parentType: data.parentType || 'user',
        name: data.name,
        read: data.read || [],
        timestamp: data.timestamp,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt || Timestamp.now(),
        isMultiUser: data.isMultiUser || false,
        messagesPicture: data.messagesPicture,
        usersInfoForDisplay: data.usersInfoForDisplay,
        lastMessage: data.lastMessage,
        lastFromUserId: data.lastFromUserId,
        messageTitle: data.messageTitle,
        lastMessageTime: data.lastMessageTime,
        isRead: data.isRead,
        isOnline: data.isOnline,
        communityId: data.communityId,
      };
    } catch (error) {
      console.error('Error getting conversation:', error);
      return null;
    }
  }

  /**
   * Subscribe to real-time updates for a specific conversation
   * Conversations are stored in 'messages' collection
   */
  subscribeToConversation(
    conversationId: string,
    callback: (conversation: FirebaseMessages | null) => void
  ): () => void {
    if (!this.firestore) {
      console.error('Firestore not initialized');
      return () => {};
    }

    const messagesRef = collection(this.firestore, 'messages');
    const conversationDoc = doc(messagesRef, conversationId);

    return onSnapshot(
      conversationDoc,
      async (docSnap) => {
        if (!docSnap.exists()) {
          callback(null);
          return;
        }

        const data = docSnap.data() as FirebaseMessages;
        
        // Get messages for this conversation
        const messages = await this.getMessagesForConversation(conversationId);
        
        callback({
          id: docSnap.id,
          conversationId: data.conversationId || conversationId,
          messages: messages,
          users: data.users || [],
          isTyping: data.isTyping || [],
          parentId: data.parentId || 0,
          parentType: data.parentType || 'user',
          name: data.name,
          read: data.read || [],
          timestamp: data.timestamp,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt || Timestamp.now(),
          isMultiUser: data.isMultiUser || false,
          messagesPicture: data.messagesPicture,
          usersInfoForDisplay: data.usersInfoForDisplay,
          lastMessage: data.lastMessage,
          lastFromUserId: data.lastFromUserId,
          messageTitle: data.messageTitle,
          lastMessageTime: data.lastMessageTime,
          isRead: data.isRead,
          isOnline: data.isOnline,
          communityId: data.communityId,
        });
      },
      (error) => {
        console.error('Error in conversation subscription:', error);
        callback(null);
      }
    );
  }

  /**
   * Get messages for a conversation
   * Messages are stored in 'messages/{conversationId}/conv' subcollection
   */
  async getMessagesForConversation(conversationId: string): Promise<FirebaseMessage[]> {
    if (!this.firestore) {
      throw new Error('Firestore not initialized');
    }

    try {
      // Try subcollection first: messages/{conversationId}/conv
      const messagesRef = collection(this.firestore, `messages/${conversationId}/conv`);
      
      // Try with orderBy first, but fallback to no orderBy if index is missing
      let querySnapshot;
      try {
        const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));
        querySnapshot = await getDocs(messagesQuery);
      } catch (orderByError: any) {
        // If orderBy fails (missing index), try without ordering
        console.warn('[ConversationService] orderBy failed, trying without ordering:', orderByError);
        querySnapshot = await getDocs(messagesRef);
      }
      
      if (querySnapshot.empty) {
        // Fallback: try collectionGroup 'conv' with parentMessageId
        try {
          const fallbackQuery = query(
            collectionGroup(this.firestore, 'conv'),
            where('parentMessageId', '==', conversationId),
            orderBy('timestamp', 'asc')
          );
          const fallbackSnapshot = await getDocs(fallbackQuery);
          const messages: FirebaseMessage[] = [];
          
          fallbackSnapshot.forEach((docSnap) => {
            const data = docSnap.data() as FirebaseMessage;
            messages.push({
              id: docSnap.id,
              ...data,
            });
          });
          
          // Sort manually if we got messages
          if (messages.length > 0) {
            messages.sort((a, b) => {
              const aTime = a.timestamp?.toMillis?.() || a.timestamp?.seconds || 0;
              const bTime = b.timestamp?.toMillis?.() || b.timestamp?.seconds || 0;
              return aTime - bTime;
            });
          }
          
          return messages;
        } catch (fallbackError) {
          console.warn('[ConversationService] Fallback query also failed:', fallbackError);
          return [];
        }
      }

      const messages: FirebaseMessage[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data() as FirebaseMessage;
        messages.push({
          id: docSnap.id,
          ...data,
        });
      });

      // Sort manually if we didn't use orderBy
      if (messages.length > 0 && !messages[0].timestamp) {
        messages.sort((a, b) => {
          const aTime = a.timestamp?.toMillis?.() || a.timestamp?.seconds || 0;
          const bTime = b.timestamp?.toMillis?.() || b.timestamp?.seconds || 0;
          return aTime - bTime;
        });
      }

      return messages;
    } catch (error) {
      console.error('Error getting messages:', error);
      return [];
    }
  }

  /**
   * Subscribe to real-time messages for a conversation
   * Messages are stored in 'messages/{conversationId}/conv' subcollection
   */
  subscribeToMessages(
    conversationId: string,
    callback: (messages: FirebaseMessage[]) => void
  ): () => void {
    if (!this.firestore) {
      console.error('Firestore not initialized');
      return () => {};
    }

    // Try subcollection first
    const messagesRef = collection(this.firestore, `messages/${conversationId}/conv`);
    const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));

    return onSnapshot(
      messagesQuery,
      (querySnapshot) => {
        const messages: FirebaseMessage[] = [];

        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data() as FirebaseMessage;
          messages.push({
            id: docSnap.id,
            ...data,
          });
        });

        callback(messages);
      },
      (error) => {
        // If subcollection fails, try collectionGroup as fallback
        console.warn('Subcollection query failed, trying collectionGroup:', error);
        if (!this.firestore) {
          console.error('Firestore not initialized');
          return;
        }
        const fallbackQuery = query(
          collectionGroup(this.firestore, 'conv'),
          where('parentMessageId', '==', conversationId),
          orderBy('timestamp', 'asc')
        );

        return onSnapshot(
          fallbackQuery,
          (querySnapshot) => {
            const messages: FirebaseMessage[] = [];

            querySnapshot.forEach((docSnap) => {
              const data = docSnap.data() as FirebaseMessage;
              messages.push({
                id: docSnap.id,
                ...data,
              });
            });

            callback(messages);
          },
          (fallbackError) => {
            console.error('Error in messages subscription:', fallbackError);
          }
        );
      }
    );
  }

  /**
   * Send a message
   * Messages are added to 'messages/{conversationId}/conv' subcollection
   */
  async sendMessage(
    conversationId: string,
    userId: number,
    message: string,
    parentId: number,
    parentType: string = 'user'
  ): Promise<void> {
    if (!this.firestore) {
      throw new Error('Firestore not initialized');
    }

    try {
      const authStore = useAuthStore();
      const user = authStore.user;

      // Get conversation document
      const messagesRef = collection(this.firestore, 'messages');
      const conversationDoc = doc(messagesRef, conversationId);
      const conversationSnap = await getDoc(conversationDoc);
      
      if (!conversationSnap.exists()) {
        throw new Error('Conversation not found');
      }

      // Add message to subcollection: messages/{conversationId}/conv
      const messagesCollection = collection(this.firestore, `messages/${conversationId}/conv`);
      
      const newMessage: Omit<FirebaseMessage, 'id'> = {
        parentMessageId: conversationId,
        userId: userId,
        message: message,
        timestamp: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        isActive: true,
        authorName: user?.fname && user?.lname ? `${user.fname} ${user.lname}` : user?.email || 'Unknown',
        authorPicture: user?.profilePicture || '',
      };

      await addDoc(messagesCollection, newMessage);

      // Update conversation's last message and timestamp
      const conversationData = conversationSnap.data() as FirebaseMessages;
      const readUsers = conversationData.read || [];
      if (!readUsers.includes(userId)) {
        readUsers.push(userId);
      }

      await updateDoc(conversationDoc, {
        lastMessage: message,
        lastFromUserId: userId,
        lastMessageTime: Timestamp.now().toDate().toISOString(),
        updatedAt: Timestamp.now(),
        read: readUsers,
        isRead: readUsers.length === conversationData.users?.length,
      });

      // Update user message references for all participants
      if (conversationData.users) {
        for (const toUserId of conversationData.users) {
          if (toUserId !== userId) {
            const userMessagesRef = collection(this.firestore, `users/${toUserId}/messages`);
            const userMessageDoc = doc(userMessagesRef, conversationId);
            await setDoc(userMessageDoc, {
              updatedAt: Timestamp.now(),
              lastMessage: message,
              fromUserId: userId,
            }, { merge: true });
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Mark conversation as read
   */
  async markAsRead(conversationId: string, userId: number): Promise<void> {
    if (!this.firestore) {
      throw new Error('Firestore not initialized');
    }

    try {
      const messagesRef = collection(this.firestore, 'messages');
      const conversationDoc = doc(messagesRef, conversationId);
      const docSnap = await getDoc(conversationDoc);
      
      if (!docSnap.exists()) {
        return;
      }

      const data = docSnap.data() as FirebaseMessages;
      const readUsers = data.read || [];
      
      if (!readUsers.includes(userId)) {
        readUsers.push(userId);
      }

      await updateDoc(conversationDoc, {
        read: readUsers,
        isRead: readUsers.length === data.users?.length,
      });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }

  /**
   * Update typing indicator
   */
  async setTyping(conversationId: string, userId: number, isTyping: boolean): Promise<void> {
    if (!this.firestore) {
      throw new Error('Firestore not initialized');
    }

    try {
      const messagesRef = collection(this.firestore, 'messages');
      const conversationDoc = doc(messagesRef, conversationId);
      const docSnap = await getDoc(conversationDoc);
      
      if (!docSnap.exists()) {
        return;
      }

      const data = docSnap.data() as FirebaseMessages;
      let typingUsers = data.isTyping || [];
      
      if (isTyping) {
        if (!typingUsers.includes(userId)) {
          typingUsers.push(userId);
        }
      } else {
        typingUsers = typingUsers.filter((id) => id !== userId);
      }

      await updateDoc(conversationDoc, {
        isTyping: typingUsers,
      });
    } catch (error) {
      console.error('Error updating typing indicator:', error);
    }
  }
}

export const conversationService = new ConversationService();

