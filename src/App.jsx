import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebase';
import specData from './assets/specData.json';
import AdminLogin from './components/AdminLogin';
import AdminPortal from './components/AdminPortal';
import SpecMatrix from './components/SpecMatrix';

function App() {
  const [isAdminView, setIsAdminView] = useState(window.location.pathname === '/admin');

  useEffect(() => {
    const handlePopState = () => setIsAdminView(window.location.pathname === '/admin');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const urlParams = new URLSearchParams(window.location.search);
  const lockToTab = urlParams.get('tab');
  const currentTabs = Object.keys(specData);

  const [activeTab, setActiveTab] = useState(() => {
    if (lockToTab && currentTabs.includes(lockToTab)) return lockToTab;
    return currentTabs[0];
  });

  const [theme, setTheme] = useState({
    primary: '#0056b3',
    secondary: '#f8f9fa',
    fontColor: '#1e293b',
    headerFontColor: '#334155',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  });

  const [hiddenItems, setHiddenItems] = useState({});
  const [categoryOrder, setCategoryOrder] = useState({});
  const [featureOrder, setFeatureOrder] = useState({});
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const unsubTheme = onSnapshot(doc(db, 'app_theme', 'colors'), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setTheme(data);
      document.documentElement.style.setProperty('--primary-color',      data.primary         || '#0056b3');
      document.documentElement.style.setProperty('--secondary-color',    data.secondary       || '#f8f9fa');
      document.documentElement.style.setProperty('--font-color',         data.fontColor       || '#1e293b');
      document.documentElement.style.setProperty('--header-font-color',  data.headerFontColor || '#334155');
      document.documentElement.style.setProperty('--font-family',        data.fontFamily      || 'system-ui, sans-serif');
    });

    const unsubVisibility = onSnapshot(doc(db, 'app_settings', 'visibility'), (snap) => {
      if (snap.exists()) setHiddenItems(snap.data());
    });

    const unsubCategoryOrder = onSnapshot(doc(db, 'app_settings', 'category_order'), (snap) => {
      if (snap.exists()) setCategoryOrder(snap.data());
    });

    const unsubFeatureOrder = onSnapshot(doc(db, 'app_settings', 'feature_order'), (snap) => {
      if (snap.exists()) setFeatureOrder(snap.data());
    });

    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser?.email && !currentUser.email.toLowerCase().endsWith('@denovix.com')) {
        signOut(auth);
        setUser(null);
        setAuthError('Access Denied. Entry restricted to verified @DeNovix.com emails only.');
      } else {
        setUser(currentUser);
      }
    });

    return () => {
      unsubTheme();
      unsubVisibility();
      unsubCategoryOrder();
      unsubFeatureOrder();
      unsubAuth();
    };
  }, []);

  // --- Data derivation ---

  const rawRows = specData[activeTab] || [];
  if (rawRows.length === 0) {
    return <div style={{ padding: '20px' }}>No specifications found.</div>;
  }

  const headers = rawRows[0] || [];
  const featureLabel = headers[1] || 'Specifications';
  const allProducts = headers.slice(2);

  // All features are included; each consumer (SpecMatrix, AdminPortal) applies its own visibility filter.
  const groupedCategories = {};
  rawRows.slice(1).forEach((row, originalIndex) => {
    const categoryName = row[0]?.trim() || 'General Specifications';
    const featureName = row[1];
    if (!featureName) return;
    if (!groupedCategories[categoryName]) groupedCategories[categoryName] = [];
    groupedCategories[categoryName].push({ featureName, rowData: row, id: originalIndex });
  });

  const savedTabOrder = categoryOrder[activeTab] || [];
  const extractedCategories = Object.keys(groupedCategories);
  const finalSequence = [...savedTabOrder];
  extractedCategories.forEach(cat => { if (!finalSequence.includes(cat)) finalSequence.push(cat); });
  const activeSortedCategories = finalSequence.filter(cat => extractedCategories.includes(cat));

  activeSortedCategories.forEach(catName => {
    const savedOrder = featureOrder[`${activeTab}__${catName}`] || [];
    (groupedCategories[catName] || []).sort((a, b) => {
      const iA = savedOrder.indexOf(a.featureName);
      const iB = savedOrder.indexOf(b.featureName);
      if (iA !== -1 && iB !== -1) return iA - iB;
      if (iA !== -1) return -1;
      if (iB !== -1) return 1;
      return a.id - b.id;
    });
  });

  // --- Shared handlers ---

  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    setIsAdminView(path === '/admin');
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: 'denovix.com' });
    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email || '';
      if (!email.toLowerCase().endsWith('@denovix.com')) {
        await signOut(auth);
        setAuthError('Access Denied. Entry restricted to verified @DeNovix.com emails only.');
      }
    } catch {
      setAuthError('Authentication cancelled or intercepted by security boundaries.');
    }
  };

  const handleLogout = () => signOut(auth);

  const toggleVisibilitySetting = async (keyName) => {
    await updateDoc(doc(db, 'app_settings', 'visibility'), { [keyName]: !hiddenItems[keyName] });
  };

  const handleThemeChange = async (field, value) => {
    await updateDoc(doc(db, 'app_theme', 'colors'), { [field]: value });
  };

  // --- Routing ---

  if (isAdminView) {
    if (!user) {
      return (
        <AdminLogin
          handleGoogleSignIn={handleGoogleSignIn}
          authError={authError}
          navigateTo={navigateTo}
        />
      );
    }
    return (
      <AdminPortal
        theme={theme}
        hiddenItems={hiddenItems}
        allProducts={allProducts}
        activeSortedCategories={activeSortedCategories}
        groupedCategories={groupedCategories}
        categoryOrder={categoryOrder}
        featureOrder={featureOrder}
        currentTabs={currentTabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        toggleVisibilitySetting={toggleVisibilitySetting}
        handleThemeChange={handleThemeChange}
        handleLogout={handleLogout}
        navigateTo={navigateTo}
      />
    );
  }

  return (
    <SpecMatrix
      allProducts={allProducts}
      headers={headers}
      featureLabel={featureLabel}
      activeTab={activeTab}
      lockToTab={lockToTab}
      currentTabs={currentTabs}
      setActiveTab={setActiveTab}
      navigateTo={navigateTo}
      groupedCategories={groupedCategories}
      activeSortedCategories={activeSortedCategories}
      hiddenItems={hiddenItems}
    />
  );
}

export default App;
