// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence // Persist login across tabs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  addDoc, 
  onSnapshot, 
  collection, 
  query, 
  where,
  Timestamp,
  setLogLevel,
  GeoPoint
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// --- MANDATORY FIREBASE CONFIG ---
// 1. DELETE THIS LINE:
// const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

// 2. AND REPLACE IT WITH YOUR REAL CONFIGURATION FROM FIREBASE:
const firebaseConfig = {
  apiKey: "AIzaSyCJ9cedrtsBTS9ku0GO8HPpWlbmamSg6do",
  authDomain: "medicinereminderff.firebaseapp.com",
  projectId: "medicinereminderff",
  storageBucket: "medicinereminderff.firebasestorage.app",
  messagingSenderId: "840398322893",
  appId: "1:840398322893:web:2f8c2994a6af129958fd84",
  measurementId: "G-V43Q71VYK6"
};


const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : undefined;

// Firebase App Globals
let app, auth, db;
let storage;
let currentUserId = null;
let listingsUnsubscribe = null; // To stop listening for data

// --- MAIN APP INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  main();
  const currentPath = window.location.pathname;
  
  // Page-specific initializations
  if (currentPath.includes('login.html')) {
    initLoginPage();
  }
  if (currentPath.includes('browse.html')) {
    initBrowsePage();
  }
  if (currentPath.includes('chat.html')) {
    initChatPage();
  }
  if (currentPath.includes('messages.html')) {
    initMessagesPage();
  }
  // Note: lending.html logic is initialized *after* auth state is confirmed
});

/**
 * Initializes Firebase and sets up auth listener.
 */
async function main() {
  if (!firebaseConfig.apiKey) {
    console.error("Firebase configuration is missing.");
    document.body.innerHTML = '<h1>Error: Firebase configuration is missing.</h1>';
    return;
  }
  
  try {
    // Initialize Firebase
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    
    // Enable Firestore logging for debugging
    setLogLevel('Debug');
    
    // Set login persistence to 'local'
    await setPersistence(auth, browserLocalPersistence);

    // --- MANDATORY AUTH SIGN-IN ---
    // The onAuthStateChanged listener will handle the rest
    setupAuthListener(); 
    
    if (initialAuthToken) {
      await signInWithCustomToken(auth, initialAuthToken);
    } else {
      // If no token, the user is effectively "logged out"
      // or we can sign them in anonymously if we prefer
      // await signInAnonymously(auth); 
      // For this app, we'll just let the auth state be null
      console.log("No initial token. User is not logged in.");
    }

  } catch (error) {
    console.error("Firebase Initialization Error:", error);
    document.body.innerHTML = `<h1>Error initializing app: ${error.message}</h1>`;
  }
}

/**
 * Sets up the global authentication listener.
 * This runs on every page and is the central point for auth logic.
 */
function setupAuthListener() {
  onAuthStateChanged(auth, (user) => {
    const currentPath = window.location.pathname;
    
    // Update nav and user info bar on ALL pages
    updateNavUI(user);
    if (user) {
      displayUserInfo(user.uid);
      currentUserId = user.uid;

      // --- Handle routing and data loading ---

      // 1. If user is logged in and lands on login.html, redirect to home
      if (currentPath.includes('login.html')) {
        window.location.href = 'index.html';
      }
      
      // 2. If user is on lending.html, initialize the page logic
      if (currentPath.includes('lending.html')) {
        // Ensure containers are visible when authenticated
        const addContainer = document.getElementById('add-listing-form-container');
        const listContainer = document.getElementById('listings-container');
        if (addContainer) addContainer.style.display = 'block';
        if (listContainer) listContainer.style.display = 'block';
        initLendingPage(user.uid);
      }

      // 3. If user is on helping.html, initialize helping logic
      if (currentPath.includes('helping.html')) {
        const addContainer = document.getElementById('add-helping-form-container');
        const listContainer = document.getElementById('helping-listings-container');
        if (addContainer) addContainer.style.display = 'block';
        if (listContainer) listContainer.style.display = 'block';
        initHelpingPage(user.uid);
      }

      // 4. If user is on renting.html, initialize renting logic
      if (currentPath.includes('renting.html')) {
        const addContainer = document.getElementById('add-renting-form-container');
        const listContainer = document.getElementById('renting-listings-container');
        if (addContainer) addContainer.style.display = 'block';
        if (listContainer) listContainer.style.display = 'block';
        initRentingPage(user.uid);
      }

    } else {
      // --- User is logged out ---
      hideUserInfo();
      currentUserId = null;

      // 1. If user is on a protected page, redirect to login
      if (currentPath.includes('lending.html')) {
        window.location.href = 'login.html';
      }
      if (currentPath.includes('helping.html')) {
        window.location.href = 'login.html';
      }
      if (currentPath.includes('renting.html')) {
        window.location.href = 'login.html';
      }
      
      // 2. If on other pages, just ensure listings are cleared
      if (currentPath.includes('lending.html')) {
          const listingsList = document.getElementById('listings-list');
          if (listingsList) {
              listingsList.innerHTML = '<p class="text-gray-500">Please log in to see your listings.</p>';
          }
      }
      if (currentPath.includes('helping.html')) {
          const listingsList = document.getElementById('helping-listings-list');
          if (listingsList) {
              listingsList.innerHTML = '<p class="text-gray-500">Please log in to see your services.</p>';
          }
      }
      if (currentPath.includes('renting.html')) {
          const listingsList = document.getElementById('renting-listings-list');
          if (listingsList) {
              listingsList.innerHTML = '<p class="text-gray-500">Please log in to see your rentals.</p>';
          }
      }
    }
  });
}

// --- UI UPDATE FUNCTIONS ---

/**
 * Updates the navigation bar's auth links.
 * @param {object|null} user - The Firebase user object or null.
 */
function updateNavUI(user) {
  const authLinksContainer = document.getElementById('auth-links');
  if (!authLinksContainer) return; // Not on a page with auth links

  if (user) {
    // User is logged in
    authLinksContainer.innerHTML = '<a id="logout-button" style="cursor: pointer;">Logout</a>';
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
      logoutButton.addEventListener('click', handleLogout);
    }
  } else {
    // User is logged out
    authLinksContainer.innerHTML = '<a href="login.html">Login</a>';
  }
}

function displayUserInfo(uid) {
  const userInfoBar = document.getElementById('user-info');
  const userIdDisplay = document.getElementById('user-id-display');
  if (userInfoBar && userIdDisplay) {
    userIdDisplay.textContent = uid;
    userInfoBar.style.display = 'block';
  }
}

function hideUserInfo() {
  const userInfoBar = document.getElementById('user-info');
  if (userInfoBar) {
    userInfoBar.style.display = 'none';
  }
}

// --- PAGE-SPECIFIC INITIALIZERS ---

/**
 * Sets up event listeners for the login.html page.
 */
function initLoginPage() {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const showSignupBtn = document.getElementById('show-signup');
  const showLoginBtn = document.getElementById('show-login');
  const loginContainer = document.getElementById('login-container');
  const signupContainer = document.getElementById('signup-container');

  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  if (signupForm) {
    signupForm.addEventListener('submit', handleSignup);
  }
  
  if (showSignupBtn) {
    showSignupBtn.addEventListener('click', () => {
      loginContainer.style.display = 'none';
      signupContainer.style.display = 'block';
    });
  }
  
  if (showLoginBtn) {
    showLoginBtn.addEventListener('click', () => {
      loginContainer.style.display = 'block';
      signupContainer.style.display = 'none';
    });
  }
}

/**
 * Sets up listeners for the lending.html page.
 * @param {string} uid - The current user's ID.
 */
function initLendingPage(uid) {
  const addListingForm = document.getElementById('add-listing-form');
  const listingsList = document.getElementById('listings-list');
  
  if (addListingForm) {
    addListingForm.addEventListener('submit', (e) => handleAddListing(e, uid));
  }
  
  if (listingsList) {
    fetchUserListings(uid);
  }
}

/**
 * Sets up listeners for the helping.html page.
 * @param {string} uid - The current user's ID.
 */
function initHelpingPage(uid) {
  const addHelpingForm = document.getElementById('add-helping-form');
  const listingsList = document.getElementById('helping-listings-list');

  if (addHelpingForm) {
    addHelpingForm.addEventListener('submit', (e) => handleAddHelping(e, uid));
  }

  if (listingsList) {
    fetchUserHelping(uid);
  }
}

/**
 * Sets up listeners for the renting.html page.
 * @param {string} uid - The current user's ID.
 */
function initRentingPage(uid) {
  const addRentingForm = document.getElementById('add-renting-form');
  const listingsList = document.getElementById('renting-listings-list');

  if (addRentingForm) {
    addRentingForm.addEventListener('submit', (e) => handleAddRenting(e, uid));
  }

  if (listingsList) {
    fetchUserRenting(uid);
  }
}

// --- AUTHENTICATION HANDLERS ---

/**
 * Handles the login form submission.
 */
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  
  hideMessages();

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged will handle redirect
  } catch (error) {
    console.error("Login Error:", error);
    showMessage(errorEl, error.message);
  }
}

/**
 * Handles the signup form submission.
 */
async function handleSignup(e) {
  e.preventDefault();
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const errorEl = document.getElementById('signup-error');
  const successEl = document.getElementById('signup-success');
  
  hideMessages();

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    showMessage(successEl, 'Account created! Please log in.', false);
    // Switch to login view
    document.getElementById('login-container').style.display = 'block';
    document.getElementById('signup-container').style.display = 'none';
  } catch (error) {
    console.error("Signup Error:", error);
    showMessage(errorEl, error.message);
  }
}

/**
 * Handles the logout button click.
 */
async function handleLogout() {
  try {
    await signOut(auth);
    // onAuthStateChanged will handle redirect to login
  } catch (error) {
    console.error("Logout Error:", error);
  }
}

// --- FIRESTORE (DATABASE) HANDLERS ---

/**
 * Gets the Firestore collection path for the user's private listings.
 * @param {string} uid - The user's ID.
 * @returns {object} A Firestore CollectionReference.
 */
function getUserListingsCollection(uid) {
  // MANDATORY: Store private data in /artifacts/{appId}/users/{userId}/...
  return collection(db, 'artifacts', appId, 'users', uid, 'listings');
}

/**
 * Collection for user's helping services
 */
function getUserHelpingCollection(uid) {
  return collection(db, 'artifacts', appId, 'users', uid, 'helping');
}

/**
 * Collection for user's rentals
 */
function getUserRentingCollection(uid) {
  return collection(db, 'artifacts', appId, 'users', uid, 'rentals');
}

/** Public listings collection (all users can read) */
function getPublicListingsCollection() {
  return collection(db, 'artifacts', appId, 'public_listings');
}

/**
 * Handles the "Add Listing" form submission.
 * @param {Event} e - The form submit event.
 * @param {string} uid - The current user's ID.
 */
async function handleAddListing(e, uid) {
  e.preventDefault();
  const errorEl = document.getElementById('form-error-message');
  hideMessages();
  
  if (!uid) {
    showMessage(errorEl, "You must be logged in to add a listing.");
    return;
  }

  const title = document.getElementById('listing-title').value;
  const description = document.getElementById('listing-description').value;
  const type = document.getElementById('listing-type').value;

  if (!title || !description || !type) {
    showMessage(errorEl, "Please fill out all fields.");
    return;
  }

  try {
    const listingsCol = getUserListingsCollection(uid);
    const payload = {
      title: title,
      description: description,
      type: type,
      createdAt: Timestamp.now()
    };
    // optional multiple image upload
    const fileInput = document.getElementById('listing-images');
    if (fileInput && fileInput.files && fileInput.files.length) {
      const files = Array.from(fileInput.files).slice(0, 5);
      const urls = await uploadListingImages(uid, files);
      if (urls && urls.length) payload.imageUrls = urls;
    }
    await addDoc(listingsCol, payload);

    // If public, also write to public listings with geolocation
    const makePublic = document.getElementById('listing-public');
    if (makePublic && makePublic.checked) {
      const coords = await getCurrentCoordsSafe();
      const publicPayload = {
        ...payload,
        ownerId: uid,
        category: 'lending',
        location: coords ? new GeoPoint(coords.latitude, coords.longitude) : null
      };
      const pubCol = getPublicListingsCollection();
      await addDoc(pubCol, publicPayload);
    }

    // Clear the form
    e.target.reset();

  } catch (error) {
    console.error("Error adding document: ", error);
    showMessage(errorEl, "Error saving listing: " + error.message);
  }
}

/**
 * Handles the helping form submission.
 */
async function handleAddHelping(e, uid) {
  e.preventDefault();
  const errorEl = document.getElementById('form-helping-error-message');
  hideMessages();

  if (!uid) {
    showMessage(errorEl, "You must be logged in to offer a service.");
    return;
  }

  const title = document.getElementById('helping-title').value;
  const description = document.getElementById('helping-description').value;
  const type = document.getElementById('helping-type').value;

  if (!title || !description || !type) {
    showMessage(errorEl, "Please fill out all fields.");
    return;
  }

  try {
    const helpingCol = getUserHelpingCollection(uid);
    const payload = {
      title: title,
      description: description,
      type: type,
      createdAt: Timestamp.now()
    };
    const fileInput = document.getElementById('helping-images');
    if (fileInput && fileInput.files && fileInput.files.length) {
      const files = Array.from(fileInput.files).slice(0, 5);
      const urls = await uploadListingImages(uid, files);
      if (urls && urls.length) payload.imageUrls = urls;
    }
    await addDoc(helpingCol, payload);

    const makePublic = document.getElementById('helping-public');
    if (makePublic && makePublic.checked) {
      const coords = await getCurrentCoordsSafe();
      const publicPayload = {
        ...payload,
        ownerId: uid,
        category: 'helping',
        location: coords ? new GeoPoint(coords.latitude, coords.longitude) : null
      };
      const pubCol = getPublicListingsCollection();
      await addDoc(pubCol, publicPayload);
    }
    e.target.reset();
  } catch (error) {
    console.error("Error adding helping document: ", error);
    showMessage(errorEl, "Error saving service: " + error.message);
  }
}

/**
 * Handles the renting form submission.
 */
async function handleAddRenting(e, uid) {
  e.preventDefault();
  const errorEl = document.getElementById('form-renting-error-message');
  hideMessages();

  if (!uid) {
    showMessage(errorEl, "You must be logged in to add a rental.");
    return;
  }

  const title = document.getElementById('renting-title').value;
  const description = document.getElementById('renting-description').value;
  const type = document.getElementById('renting-type').value;

  if (!title || !description || !type) {
    showMessage(errorEl, "Please fill out all fields.");
    return;
  }

  try {
    const rentingCol = getUserRentingCollection(uid);
    const payload = {
      title: title,
      description: description,
      type: type,
      createdAt: Timestamp.now()
    };
    const fileInput = document.getElementById('renting-images');
    if (fileInput && fileInput.files && fileInput.files.length) {
      const files = Array.from(fileInput.files).slice(0, 5);
      const urls = await uploadListingImages(uid, files);
      if (urls && urls.length) payload.imageUrls = urls;
    }
    await addDoc(rentingCol, payload);

    const makePublic = document.getElementById('renting-public');
    if (makePublic && makePublic.checked) {
      const coords = await getCurrentCoordsSafe();
      const publicPayload = {
        ...payload,
        ownerId: uid,
        category: 'renting',
        location: coords ? new GeoPoint(coords.latitude, coords.longitude) : null
      };
      const pubCol = getPublicListingsCollection();
      await addDoc(pubCol, publicPayload);
    }
    e.target.reset();
  } catch (error) {
    console.error("Error adding renting document: ", error);
    showMessage(errorEl, "Error saving rental: " + error.message);
  }
}

/**
 * Fetches and displays the user's listings in real-time.
 * @param {string} uid - The current user's ID.
 */
function fetchUserListings(uid) {
  if (listingsUnsubscribe) {
    listingsUnsubscribe(); // Unsubscribe from old listener
  }

  const listingsCol = getUserListingsCollection(uid);
  
  // Use onSnapshot for real-time updates
  listingsUnsubscribe = onSnapshot(listingsCol, (snapshot) => {
    const listings = [];
    snapshot.forEach((doc) => {
      listings.push({ id: doc.id, ...doc.data() });
    });
    
    // Sort by creation time (newest first)
    listings.sort((a, b) => {
        const timeA = a.createdAt ? a.createdAt.seconds : 0;
        const timeB = b.createdAt ? b.createdAt.seconds : 0;
        return timeB - timeA;
    });

    displayListings(listings);
  }, (error) => {
    console.error("Error fetching listings: ", error);
    const listingsList = document.getElementById('listings-list');
    if (listingsList) {
        listingsList.innerHTML = '<p class="error-message">Error loading listings.</p>';
    }
  });
}

/**
 * Fetch and display helping services (real-time)
 */
function fetchUserHelping(uid) {
  if (listingsUnsubscribe) {
    listingsUnsubscribe();
  }

  const helpingCol = getUserHelpingCollection(uid);
  listingsUnsubscribe = onSnapshot(helpingCol, (snapshot) => {
    const services = [];
    snapshot.forEach((doc) => {
      services.push({ id: doc.id, ...doc.data() });
    });
    services.sort((a, b) => {
      const timeA = a.createdAt ? a.createdAt.seconds : 0;
      const timeB = b.createdAt ? b.createdAt.seconds : 0;
      return timeB - timeA;
    });
    displayHelpingListings(services);
  }, (error) => {
    console.error("Error fetching services: ", error);
    const list = document.getElementById('helping-listings-list');
    if (list) list.innerHTML = '<p class="error-message">Error loading services.</p>';
  });
}

/**
 * Fetch and display rentals (real-time)
 */
function fetchUserRenting(uid) {
  if (listingsUnsubscribe) {
    listingsUnsubscribe();
  }

  const rentingCol = getUserRentingCollection(uid);
  listingsUnsubscribe = onSnapshot(rentingCol, (snapshot) => {
    const rentals = [];
    snapshot.forEach((doc) => {
      rentals.push({ id: doc.id, ...doc.data() });
    });
    rentals.sort((a, b) => {
      const timeA = a.createdAt ? a.createdAt.seconds : 0;
      const timeB = b.createdAt ? b.createdAt.seconds : 0;
      return timeB - timeA;
    });
    displayRentingListings(rentals);
  }, (error) => {
    console.error("Error fetching rentals: ", error);
    const list = document.getElementById('renting-listings-list');
    if (list) list.innerHTML = '<p class="error-message">Error loading rentals.</p>';
  });
}

/**
 * Renders the listings to the DOM.
 * @param {Array} listings - An array of listing objects.
 */
function displayListings(listings) {
  const listingsList = document.getElementById('listings-list');
  if (!listingsList) return;

  if (listings.length === 0) {
    listingsList.innerHTML = '<p class="text-gray-500">No listings found. Add one above!</p>';
    return;
  }

  listingsList.innerHTML = listings.map(listing => `
    <div class="listing-item">
      <span>${listing.type}</span>
      <h3>${listing.title}</h3>
      ${Array.isArray(listing.imageUrls) && listing.imageUrls.length ? `
        <div class="gallery">
          ${listing.imageUrls.map(u => `<img src="${u}" alt="image" />`).join('')}
        </div>` : ''}
      <p>${listing.description}</p>
    </div>
  `).join('');
}

// ---- GEOLOCATION + BROWSE ----

async function getCurrentCoordsSafe() {
  try {
    const coords = await getBrowserLocation();
    if (coords) {
      localStorage.setItem('helpin:lastCoords', JSON.stringify(coords));
      return coords;
    }
  } catch (_) {}
  const cached = localStorage.getItem('helpin:lastCoords');
  return cached ? JSON.parse(cached) : null;
}

function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return resolve(null);
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

function haversineKm(aLat, aLng, bLat, bLng) {
  const toRad = (v) => v * Math.PI / 180;
  const R = 6371; // km
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const A =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(A), Math.sqrt(1-A));
  return R * c;
}

function initBrowsePage() {
  const useLocationBtn = document.getElementById('use-location');
  const radiusSelect = document.getElementById('radius-km');
  const list = document.getElementById('public-listings-list');
  const filterCategory = document.getElementById('filter-category');
  const filterText = document.getElementById('filter-text');
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  const pageInfo = document.getElementById('page-info');

  const state = { items: [], page: 1, pageSize: 6, userCoords: null, radiusKm: 5, category: 'all', search: '' };

  const render = async () => {
    state.userCoords = await getCurrentCoordsSafe();
    state.radiusKm = parseInt(radiusSelect.value, 10);
    state.category = filterCategory ? filterCategory.value : 'all';
    state.search = filterText ? (filterText.value || '').toLowerCase() : '';
    fetchPublicListingsWithState(state, list, pageInfo, prevBtn, nextBtn);
  };

  if (useLocationBtn) useLocationBtn.addEventListener('click', render);
  if (radiusSelect) radiusSelect.addEventListener('change', render);
  if (filterCategory) filterCategory.addEventListener('change', () => { state.page = 1; render(); });
  if (filterText) filterText.addEventListener('input', () => { state.page = 1; render(); });
  if (prevBtn) prevBtn.addEventListener('click', () => { if (state.page > 1) { state.page--; render(); } });
  if (nextBtn) nextBtn.addEventListener('click', () => { state.page++; render(); });
  // Initial load without requiring click
  render();
}

// Map helpers
let browseMap = null;
let browseLayer = null;

function ensureMap(coords) {
  const mapEl = document.getElementById('map');
  if (!mapEl || typeof L === 'undefined') return;
  if (!browseMap) {
    browseMap = L.map('map');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(browseMap);
    browseLayer = L.layerGroup().addTo(browseMap);
  }
  const lat = coords?.latitude ?? 20.5937; // fallback to India centroid
  const lng = coords?.longitude ?? 78.9629;
  browseMap.setView([lat, lng], coords ? 12 : 5);
}

function updateMapMarkers(listings, coords) {
  if (!browseLayer || typeof L === 'undefined') return;
  browseLayer.clearLayers();
  const markers = [];
  listings.forEach(it => {
    if (it.location && typeof it.location.latitude === 'number') {
      const m = L.marker([it.location.latitude, it.location.longitude])
        .bindPopup(`<b>${it.title}</b><br/>${it.type ?? ''}`);
      browseLayer.addLayer(m);
      markers.push([it.location.latitude, it.location.longitude]);
    }
  });
  if (markers.length) {
    const bounds = L.latLngBounds(markers);
    browseMap.fitBounds(bounds.pad(0.2));
  }
}

function fetchPublicListingsWithState(state, listEl, pageInfoEl, prevBtn, nextBtn) {
  const pubCol = getPublicListingsCollection();
  onSnapshot(pubCol, (snapshot) => {
    const items = [];
    snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));

    // Category filter
    let filtered = (state.category === 'all') ? items : items.filter(it => (it.category === state.category));

    // Search filter (title/type)
    if (state.search) {
      filtered = filtered.filter(it => {
        const title = (it.title || '').toLowerCase();
        const type = (it.type || '').toLowerCase();
        return title.includes(state.search) || type.includes(state.search);
      });
    }

    if (state.userCoords) {
      filtered = filtered.map(it => {
        let distanceKm = null;
        if (it.location && typeof it.location.latitude === 'number') {
          distanceKm = haversineKm(
            state.userCoords.latitude,
            state.userCoords.longitude,
            it.location.latitude,
            it.location.longitude
          );
        }
        return { ...it, distanceKm };
      }).filter(it => it.distanceKm === null || it.distanceKm <= state.radiusKm);

      // Sort by distance then time
      filtered.sort((a, b) => {
        const da = a.distanceKm ?? 999999;
        const db = b.distanceKm ?? 999999;
        if (da !== db) return da - db;
        const ta = a.createdAt ? a.createdAt.seconds : 0;
        const tb = b.createdAt ? b.createdAt.seconds : 0;
        return tb - ta;
      });
    } else {
      filtered.sort((a, b) => {
        const ta = a.createdAt ? a.createdAt.seconds : 0;
        const tb = b.createdAt ? b.createdAt.seconds : 0;
        return tb - ta;
      });
    }

    // Pagination
    const total = filtered.length;
    const pageSize = state.pageSize;
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    if (state.page > maxPage) state.page = maxPage;
    const start = (state.page - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);

    if (pageInfoEl) pageInfoEl.textContent = `Page ${state.page} / ${maxPage} • ${total} items`;
    if (prevBtn) prevBtn.disabled = state.page <= 1;
    if (nextBtn) nextBtn.disabled = state.page >= maxPage;

    // Update map and list
    ensureMap(state.userCoords);
    updateMapMarkers(filtered, state.userCoords);
    displayPublicListings(pageItems);
  }, (error) => {
    console.error('Error fetching public listings', error);
    const el = document.getElementById('public-listings-list');
    if (el) el.innerHTML = '<p class="error-message">Error loading public listings.</p>';
  });
}

// --- PUBLIC LISTING MUTATIONS & IMAGE UPLOAD ---

async function deletePublicListing(id) {
  const col = getPublicListingsCollection();
  const dref = doc(col, id);
  const { deleteDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
  await deleteDoc(dref);
}

async function updatePublicListing(id, data) {
  const col = getPublicListingsCollection();
  const dref = doc(col, id);
  const { updateDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
  await updateDoc(dref, data);
}

async function uploadListingImage(uid, file) {
  try {
    const path = `artifacts/${appId}/users/${uid}/images/${Date.now()}_${file.name}`;
    const ref = storageRef(storage, path);
    await uploadBytes(ref, file);
    return await getDownloadURL(ref);
  } catch (e) {
    console.error('Image upload failed', e);
    return null;
  }
}

async function uploadListingImages(uid, files) {
  const urls = [];
  for (const file of files) {
    const url = await uploadListingImage(uid, file);
    if (url) urls.push(url);
  }
  return urls;
}

function displayPublicListings(listings) {
  const el = document.getElementById('public-listings-list');
  if (!el) return;
  if (listings.length === 0) {
    el.innerHTML = '<p class="text-gray-500">No public listings found.</p>';
    return;
  }
  const currentUid = currentUserId;
  el.innerHTML = listings.map(it => {
    const ownerControls = (currentUid && it.ownerId === currentUid) ? `
      <div style="margin-top:8px;display:flex;gap:8px;">
        <button class="btn-edit" data-id="${it.id}">Edit</button>
        <button class="btn-delete" data-id="${it.id}">Delete</button>
      </div>
    ` : (currentUid && it.ownerId !== currentUid) ? `
      <div style="margin-top:8px;">
        <a class="btn-contact" href="chat.html?with=${it.ownerId}&title=${encodeURIComponent(it.title)}">Contact</a>
      </div>
    ` : '';
    const imageTag = Array.isArray(it.imageUrls) && it.imageUrls.length ? `
      <div class="gallery">${it.imageUrls.map(u => `<img src="${u}" alt="image" />`).join('')}</div>` : '';
    return `
    <div class="listing-item" data-id="${it.id}">
      <span>${it.category ?? ''}${it.type ? ' • ' + it.type : ''}</span>
      <h3>${it.title}</h3>
      ${imageTag}
      <p>${it.description}</p>
      ${it.distanceKm != null ? `<p style=\"margin-top:6px;color:#6b7280;\">~${it.distanceKm.toFixed(1)} km away</p>` : ''}
      ${ownerControls}
    </div>`;
  }).join('');

  // Wire edit/delete handlers
  el.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      if (!id) return;
      if (!confirm('Delete this public listing?')) return;
      try {
        await deletePublicListing(id);
      } catch (err) {
        console.error('Delete failed', err);
        alert('Failed to delete');
      }
    });
  });
  el.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      const title = prompt('New title?');
      if (title == null) return;
      const description = prompt('New description?');
      if (description == null) return;
      try {
        await updatePublicListing(id, { title, description });
      } catch (err) {
        console.error('Update failed', err);
        alert('Failed to update');
      }
    });
  });
}

/**
 * Render helping services to DOM
 */
function displayHelpingListings(listings) {
  const list = document.getElementById('helping-listings-list');
  if (!list) return;
  if (listings.length === 0) {
    list.innerHTML = '<p class="text-gray-500">No services found. Add one above!</p>';
    return;
  }
  list.innerHTML = listings.map(item => `
    <div class="listing-item">
      <span>${item.type}</span>
      <h3>${item.title}</h3>
      ${Array.isArray(item.imageUrls) && item.imageUrls.length ? `
        <div class="gallery">
          ${item.imageUrls.map(u => `<img src="${u}" alt="image" />`).join('')}
        </div>` : ''}
      <p>${item.description}</p>
    </div>
  `).join('');
}

/**
 * Render rentals to DOM
 */
function displayRentingListings(listings) {
  const list = document.getElementById('renting-listings-list');
  if (!list) return;
  if (listings.length === 0) {
    list.innerHTML = '<p class="text-gray-500">No rentals found. Add one above!</p>';
    return;
  }
  list.innerHTML = listings.map(item => `
    <div class="listing-item">
      <span>${item.type}</span>
      <h3>${item.title}</h3>
      ${Array.isArray(item.imageUrls) && item.imageUrls.length ? `
        <div class="gallery">
          ${item.imageUrls.map(u => `<img src="${u}" alt="image" />`).join('')}
        </div>` : ''}
      <p>${item.description}</p>
    </div>
  `).join('');
}

// --- HELPER FUNCTIONS ---

/**
 * Shows a message in a specified element.
 * @param {HTMLElement} element - The DOM element to show the message in.
 * @param {string} message - The message text.
 * @param {boolean} [isError=true] - Toggles error (red) or success (green) styling.
 */
function showMessage(element, message, isError = true) {
    if (!element) return;
    element.textContent = message;
    element.className = isError ? 'error-message' : 'success-message';
    element.style.display = 'block';
}

/**
 * Hides all error/success messages.
 */
function hideMessages() {
  const messages = document.querySelectorAll('.error-message, .success-message');
  messages.forEach(msg => {
    msg.style.display = 'none';
    msg.textContent = '';
  });
}

// --- CHAT ---

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function conversationIdFor(a, b) {
  return [a, b].sort().join('_');
}

function getConversationRef(a, b) {
  return doc(collection(db, 'artifacts', appId, 'conversations'), conversationIdFor(a, b));
}

function getMessagesCollection(a, b) {
  return collection(db, 'artifacts', appId, 'conversations', conversationIdFor(a, b), 'messages');
}

function initChatPage() {
  const otherId = getQueryParam('with');
  const title = getQueryParam('title');
  const header = document.getElementById('chat-header');
  if (header) header.textContent = otherId ? `Chat with ${otherId}${title ? ' about: ' + title : ''}` : 'Open a conversation';

  if (!currentUserId) {
    // Wait for auth listener to set currentUserId
    const check = setInterval(() => {
      if (currentUserId) {
        clearInterval(check);
        setupChat(currentUserId, otherId);
      }
    }, 200);
  } else {
    setupChat(currentUserId, otherId);
  }
}

function setupChat(myId, otherId) {
  if (!otherId) return;
  const messagesEl = document.getElementById('messages');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');

  // Ensure conversation doc exists
  (async () => {
    const cref = getConversationRef(myId, otherId);
    const { getDoc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
    const snap = await getDoc(cref);
    if (!snap.exists()) {
      await setDoc(cref, { members: [myId, otherId], createdAt: serverTimestamp() });
    }
  })();

  // Listen for messages
  const msgs = getMessagesCollection(myId, otherId);
  onSnapshot(msgs, (snapshot) => {
    const arr = [];
    snapshot.forEach(d => arr.push({ id: d.id, ...d.data() }));
    arr.sort((a, b) => {
      const ta = a.createdAt ? a.createdAt.seconds : 0;
      const tb = b.createdAt ? b.createdAt.seconds : 0;
      return ta - tb;
    });
    if (messagesEl) {
      messagesEl.innerHTML = arr.map(m => `
        <div style="align-self:${m.senderId === myId ? 'flex-end' : 'flex-start'};background:${m.senderId === myId ? '#dcfce7' : '#f3f4f6'};padding:8px 12px;border-radius:12px;max-width:75%;">
          <div style="font-size:0.8rem;color:#6b7280;margin-bottom:4px;">${m.senderId}</div>
          <div>${(m.text || '').replace(/</g,'&lt;')}</div>
        </div>
      `).join('');
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    // Browser notification for the latest incoming message
    const last = arr[arr.length - 1];
    if (last && last.senderId !== myId) {
      if (Notification && Notification.permission === 'granted') {
        new Notification('New message', { body: last.text || 'New message received' });
      } else if (Notification && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      const { addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
      await addDoc(msgs, { senderId: myId, text, createdAt: serverTimestamp() });
    });
  }
}

function initMessagesPage() {
  if (!currentUserId) {
    const check = setInterval(() => {
      if (currentUserId) {
        clearInterval(check);
        loadConversations(currentUserId);
      }
    }, 200);
  } else {
    loadConversations(currentUserId);
  }
}

function loadConversations(myId) {
  const listEl = document.getElementById('conversations-list');
  const convsCol = collection(db, 'artifacts', appId, 'conversations');

  // --- This is the updated part ---
  // We create a query to *only* get conversations where the 'members' array contains our ID
  const q = query(convsCol, where('members', 'array-contains', myId));
  
  // We use the new query 'q' instead of the full 'convsCol'
  onSnapshot(q, (snapshot) => {
  // --- End of update ---

    const entries = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      
      // The old 'if' check is removed, as the query securely handles it now
      const other = data.members.find(m => m !== myId) || myId;
      entries.push({ id: docSnap.id, otherId: other, ...data });
    });

    // Sort by most recent activity
    entries.sort((a, b) => {
      const ta = a.updatedAt ? a.updatedAt.seconds : (a.createdAt ? a.createdAt.seconds : 0);
      const tb = b.updatedAt ? b.updatedAt.seconds : (b.createdAt ? b.createdAt.seconds : 0);
      return tb - ta;
    });

    if (!entries.length) {
      listEl.innerHTML = '<p class="text-gray-500">No conversations yet.</p>';
      return;
    }

    listEl.innerHTML = entries.map(e => `
      <div class="listing-item" style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:600;">${e.otherId}</div>
          <div style="color:#6b7280;font-size:0.9rem;">Conversation</div>
        </div>
        <a class="btn-contact" href="chat.html?with=${e.otherId}">Open</a>
      </div>
    `).join('');
  });
}



