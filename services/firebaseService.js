const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  collection, 
  addDoc,
  serverTimestamp 
} = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBY5TaM_7nce64-cru_Ixv_WH6T2O5F0zM",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "restaurant-5c916.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "restaurant-5c916",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "restaurant-5c916.appspot.com",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "946267850152",
  appId: process.env.FIREBASE_APP_ID || "1:946267850152:web:213d032eac11cd1e99099d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Sync user to Firestore
 * @param {Object} userData - User data from MongoDB
 * @returns {Promise<boolean>} - Success status
 */
const syncUserToFirestore = async (userData) => {
  try {
    const uid = userData.firebaseUid || userData._id.toString();
    const userRef = doc(db, 'users', uid);
    
    const firestoreUser = {
      uid: uid,
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
      role: userData.role || 'customer',
      authProvider: userData.authProvider || 'local',
      photoURL: userData.photoURL || userData.avatar,
      isEmailVerified: userData.isEmailVerified || false,
      loyaltyPoints: userData.loyaltyPoints || 0,
      loyaltyTier: userData.loyaltyTier || 'Bronze',
      createdAt: new Date(userData.createdAt),
      updatedAt: serverTimestamp(),
      lastLogin: userData.lastLogin ? new Date(userData.lastLogin) : null
    };

    await setDoc(userRef, firestoreUser, { merge: true });
    console.log(`User ${userData.email} synced to Firestore`);
    return true;
  } catch (error) {
    console.error('Error syncing user to Firestore:', error);
    return false;
  }
};

/**
 * Create booking in Firestore
 * @param {Object} bookingData - Booking data
 * @returns {Promise<string|null>} - Booking ID or null if failed
 */
const createBookingInFirestore = async (bookingData) => {
  try {
    // Create booking in main bookings collection
    const bookingRef = await addDoc(collection(db, 'bookings'), {
      ...bookingData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    const bookingId = bookingRef.id;

    // Also create booking under user's subcollection
    const userBookingsRef = collection(db, 'users', bookingData.userId, 'bookings');
    await addDoc(userBookingsRef, {
      ...bookingData,
      bookingId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Update main booking document with bookingId
    await updateDoc(bookingRef, { bookingId });

    console.log(`Booking ${bookingId} created in Firestore`);
    return bookingId;
  } catch (error) {
    console.error('Error creating booking in Firestore:', error);
    return null;
  }
};

/**
 * Update booking status in Firestore
 * @param {string} bookingId - Booking ID
 * @param {string} status - New status
 * @returns {Promise<boolean>} - Success status
 */
const updateBookingStatusInFirestore = async (bookingId, status) => {
  try {
    const bookingRef = doc(db, 'bookings', bookingId);
    await updateDoc(bookingRef, {
      status,
      updatedAt: serverTimestamp()
    });
    console.log(`Booking ${bookingId} status updated to ${status}`);
    return true;
  } catch (error) {
    console.error('Error updating booking status in Firestore:', error);
    return false;
  }
};

/**
 * Get user from Firestore
 * @param {string} uid - User ID
 * @returns {Promise<Object|null>} - User data or null if not found
 */
const getUserFromFirestore = async (uid) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      return userDoc.data();
    }
    return null;
  } catch (error) {
    console.error('Error getting user from Firestore:', error);
    return null;
  }
};

/**
 * Delete user from Firestore
 * @param {string} uid - User ID
 * @returns {Promise<boolean>} - Success status
 */
const deleteUserFromFirestore = async (uid) => {
  try {
    // This would require the Firebase Admin SDK for server-side deletion
    // For now, we'll just log it
    console.log(`User ${uid} deletion from Firestore requires Admin SDK`);
    return true;
  } catch (error) {
    console.error('Error deleting user from Firestore:', error);
    return false;
  }
};

/**
 * Update user in Firestore
 * @param {string} uid - User ID
 * @param {Object} updates - User data updates
 * @returns {Promise<boolean>} - Success status
 */
const updateUserInFirestore = async (uid, updates) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    console.log(`User ${uid} updated in Firestore`);
    return true;
  } catch (error) {
    console.error('Error updating user in Firestore:', error);
    return false;
  }
};

module.exports = {
  syncUserToFirestore,
  createBookingInFirestore,
  updateBookingStatusInFirestore,
  getUserFromFirestore,
  deleteUserFromFirestore,
  updateUserInFirestore,
  db
};
