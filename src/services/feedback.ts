import {Platform} from 'react-native';
import {addDoc, collection, getFirestore, serverTimestamp} from '@react-native-firebase/firestore';

const db = getFirestore();

export async function submitFeedback(params: {
  userId: string;
  email?: string;
  message: string;
}) {
  const {userId, email, message} = params;
  if (!message.trim()) {
    throw new Error('Feedback is empty');
  }
  await addDoc(collection(db, 'feedback'), {
    userId,
    email: email || null,
    message: message.trim(),
    platform: Platform.OS,
    createdAt: serverTimestamp(),
  });
}

