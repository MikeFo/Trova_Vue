import { Timestamp } from 'firebase/firestore';

export interface FirebaseMessage {
  id?: string;
  parentMessageId?: string;
  userId?: number;
  timestamp?: Timestamp;
  createdAtDate?: Date;
  source?: string | null;
  slackChannelId?: string | null;
  slackTs?: string | null;
  slackUserId?: string | null;
  message?: string;
  isActive?: boolean;
  createdAt?: Timestamp;
  flagged?: boolean;
  image?: string;
  video?: string;
  authorName?: string;
  authorPicture?: string;
  updatedAt?: Timestamp;
  reactions?: FirebaseReaction[];
  mentions?: number[];
  isDeleted?: boolean;
  showTimeStamp?: boolean;
  timestampFormatted?: string;
  previousWithinMinute?: boolean;
  messageForDisplay?: string;
}


export interface FirebaseReaction {
  userId: number;
  emoji: string;
}

export interface FirebaseMessages {
  id: string;
  conversationId: string;
  messages: FirebaseMessage[];
  users: number[];
  isTyping: number[];
  parentId: number;
  parentType: string;
  name?: string;
  read: number[];
  timestamp?: Timestamp;
  createdAtDate?: Date;
  source?: string | null;
  slackChannelId?: string | null;
  slackTs?: string | null;
  slackUserId?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  isMultiUser?: boolean;
  messagesPicture?: string;
  usersInfoForDisplay?: any[];
  lastMessage?: string;
  lastFromUserId?: number;
  messageTitle?: string;
  lastMessageTime?: string;
  isRead?: boolean;
  isOnline?: boolean;
  communityId?: number;
  isSlackBacked?: boolean;
}

export interface UserFirebaseMessage {
  conversationId: string;
  updatedAt?: Timestamp;
  parentId?: number;
  parentType?: string;
}

export interface Conversation {
  id: number;
  matchId: number;
  leftUserId: number;
  rightUserId: number;
  message: Message;
  readAll: boolean;
  user: any;
  isActive: boolean;
  updatedAt: string;
}

export interface Message {
  id: number;
  conversationId: number;
  userId: number;
  body: string;
  isActive: boolean;
  read: boolean;
  createdAt: string;
  image?: string;
  authorName?: string;
  authorPicture?: string;
  updatedAt?: string;
  toUserId?: number;
  timeStamp?: string;
}

