import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { db, auth } from './firebase'; 
import specData from './assets/specData.json';

// Global Product Metadata Map tracking explicit features and optional capabilities
const PRODUCT_METADATA = {
  // --- Spectrophotometer Lineup ---
  'DS-11 FX+': { type: 'spec', modes: ['Microvolume UV-Vis', 'Cuvette UV-Vis', 'Fluorescence'], optionalModes: [], multi: false },
  'DS-11 FX':  { type: 'spec', modes: ['Microvolume UV-Vis', 'Fluorescence'], optionalModes: [], multi: false },
  'DS-11+':    { type: 'spec', modes: ['Microvolume UV-Vis', 'Cuvette UV-Vis'], optionalModes: ['Fluorescence'], multi: false },
  'DS-11':     { type: 'spec', modes: ['Microvolume UV-Vis'], optionalModes: ['Fluorescence'], multi: false },
  'DS-8X':     { type: 'spec', modes: ['Microvolume UV-Vis'], optionalModes: ['Fluorescence'], multi: true },
  'DS-8X+':    { type: 'spec', modes: ['Microvolume UV-Vis', 'Cuvette UV-Vis'], optionalModes: ['Fluorescence'], multi: true },
  'DS-C':      { type: 'spec', modes: ['Cuvette UV-Vis'], optionalModes: ['Fluorescence'], multi: false },
  'QFX':       { type: 'spec', modes: ['Fluorescence'], optionalModes: [], multi: false },
  'Helium':    { type: 'spec', modes: [], optionalModes: ['Fluorescence'], multi: false },
  'DS-7+':     { type: 'spec', modes: ['Microvolume UV-Vis', 'Cuvette UV-Vis'], optionalModes: [], multi: false },
  'DS-7':      { type: 'spec', modes: ['Microvolume UV-Vis'], optionalModes: [], multi: false },

  // --- Cell Counter Lineup (Mapped directly to your individual model headers) ---
  'CellDrop FLi':  { type: 'counter', optics: ['Brightfield', 'Fluorescence'], magnification: ['Standard Magnification'] },
  'CellDrop FLxi': { type: 'counter', optics: ['Brightfield', 'Fluorescence'], magnification: ['High Magnification'] },
  'CellDrop BF':   { type: 'counter', optics: ['Brightfield'], magnification: ['Standard Magnification'] },
  'CellDrop BFx':  { type: 'counter', optics: ['Brightfield'], magnification: ['High Magnification'] },
  
  'default':   { type: 'unknown', modes: [], optionalModes: [], optics: [], magnification: [] }
};

const FONT_OPTIONS = [
  { label: 'System Sans (Default)', value: 'system-ui, -apple-system, sans-serif' },
  { label: 'Helvetica / Arial', value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: 'Inter / Roboto', value: '"Inter", "Roboto", "Segoe UI", sans-serif' },
  { label: 'Georgia / Serif', value: 'Georgia, Cambria, "Times New Roman", Times, serif' },
  { label: 'Monospace Tech', value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace' }
];

function App() {
  const [isAdminView, setIsAdminView] = useState(window.location.pathname === '/admin');

  useEffect(() => {
    const handleLocationChange = () => {
      setIsAdminView(window.location.pathname === '/admin');
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const urlParams = new URLSearchParams(window.location.search);
  const lockToTab = urlParams.get('tab');

  const currentTabs = Object.keys(specData);
  
  const [activeTab, setActiveTab] = useState(() => {
    if (lockToTab && currentTabs.includes(lockToTab)) {
      return lockToTab;
    }
    return currentTabs[0];
  });

  const [theme, setTheme] = useState({ 
    primary: '#0056b3', 
    secondary: '#f8f9fa',
    fontColor: '#1e293b',
    headerFontColor: '#334155',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  });
  
  const [hiddenItems, setHiddenItems] = useState({});
  const [categoryOrder, setCategoryOrder] = useState({});
  const [featureOrder, setFeatureOrder] = useState({}); // Sync tracker for custom individual specification row positions

  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState('');

  // Sync state management variables
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // Multi-parameter visitor filtering states for Spectrophotometers
  const [filterModes, setFilterModes] = useState([]); 
  const [filterThroughput, setThroughput] = useState('all'); 

  // Multi-parameter visitor filtering states for Cell Counters
  const [filterOptics, setFilterOptics] = useState([]);
  const [filterMag, setFilterMag] = useState('all');

  // Interactive HTML5 dragging operational states
  const [draggedCategoryIdx, setDraggedCategoryIdx] = useState(null);
  const [draggedFeatureInfo, setDraggedFeatureInfo] = useState(null); 

  useEffect(() => {
    const unsubscribeTheme = onSnapshot(doc(db, 'app_theme', 'colors'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTheme(data);
        document.documentElement.style.setProperty('--primary-color', data.primary || '#0056b3');
        document.documentElement.style.setProperty('--secondary-color', data.secondary || '#f8f9fa');
        document.documentElement.style.setProperty('--font-color', data.fontColor || '#1e293b');
        document.documentElement.style.setProperty('--header-font-color', data.headerFontColor || '#334155');
        document.documentElement.style.setProperty('--font-family', data.fontFamily || 'system-ui, sans-serif');
      }
    });

    const unsubscribeVisibility = onSnapshot(doc(db, 'app_settings', 'visibility'), (docSnap) => {
      if (docSnap.exists()) {
        setHiddenItems(docSnap.data());
      }
    });

    const unsubscribeCategoryOrder = onSnapshot(doc(db, 'app_settings', 'category_order'), (docSnap) => {
      if (docSnap.exists()) {
        setCategoryOrder(docSnap.data());
      }
    });

    const unsubscribeFeatureOrder = onSnapshot(doc(db, 'app_settings', 'feature_order'), (docSnap) => {
      if (docSnap.exists()) {
        setFeatureOrder(docSnap.data());
      }
    });

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser && currentUser.email && !currentUser.email.toLowerCase().endsWith('@denovix.com')) {
        signOut(auth);
        setUser(null);
        setAuthError('Access Denied. Entry restricted to verified @DeNovix.com emails only.');
      } else {
        setUser(currentUser);
      }
    });

    return () => {
      unsubscribeTheme();
      unsubscribeVisibility();
      unsubscribeCategoryOrder();
      unsubscribeFeatureOrder();
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    setFilterModes([]);
    setThroughput('all');
    setFilterOptics([]);
    setFilterMag('all');
  }, [activeTab]);

  const rawRows = specData[activeTab] || [];
  if (rawRows.length === 0) return <div style={{ padding: '20px' }}>No specifications found.</div>;

  const headers = rawRows[0] || [];
  const featureLabel = headers[1] || 'Specifications'; 
  const allProducts = headers.slice(2); 

  const visibleProducts = allProducts.filter(product => !hiddenItems[product]);

  const productsToRender = visibleProducts.filter(product => {
    const meta = PRODUCT_METADATA[product] || { type: 'fallback' };
    if (meta.type === 'fallback') return true; 

    if (activeTab === 'Spectrophotometers / Fluorometers' && meta.type === 'spec') {
      const totalCapabilities = [...meta.modes, ...meta.optionalModes];
      if (filterModes.length > 0) {
        const satisfiesAllSelections = filterModes.every(mode => totalCapabilities.includes(mode));
        if (!satisfiesAllSelections) return false; 
      }
      if (filterThroughput === 'single' && meta.multi) return false;
      if (filterThroughput === 'multi' && !meta.multi) return false;
    }

    if (activeTab === 'Cell Counters' && meta.type === 'counter') {
      if (filterOptics.length > 0) {
        const filterableOptics = ['Brightfield', 'Fluorescence'];
        const hasUnselectedCapability = filterableOptics.some(optic => {
          const userDeselectedIt = !filterOptics.includes(optic);
          const instrumentHasIt = meta.optics?.includes(optic);
          return userDeselectedIt && instrumentHasIt;
        });
        if (hasUnselectedCapability) return false;
      }
      if (filterMag === 'standard' && !meta.magnification?.includes('Standard Magnification')) return false;
      if (filterMag === 'high' && !meta.magnification?.includes('High Magnification')) return false;
    }

    return true;
  });

  // Dynamic Height Reporter Hook: Measures and posts document boundaries to parent WordPress page frame
  useEffect(() => {
    const reportHeightToParent = () => {
      const actualContainerHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
      window.parent.postMessage({ type: 'RESIZE_IFRAME', height: actualContainerHeight }, '*');
    };

    reportHeightToParent();

    const pageResizeObserver = new ResizeObserver(() => reportHeightToParent());
    pageResizeObserver.observe(document.body);

    return () => pageResizeObserver.disconnect();
  }, [activeTab, productsToRender]);

  const handlePrint = () => {
    window.print();
  };

  const triggerGoogleSheetsSync = async () => {
    setIsSyncing(true);
    setSyncMessage('📡 Broadcasting build token payload...');
    
    const PRODUCTION_BUILD_HOOK = "https://api.netlify.com/build_hooks/6a0ea4fbd0b12f31ddc93278";

    if (PRODUCTION_BUILD_HOOK.includes("YOUR_NETLIFY_HOOK_ID")) {
      setSyncMessage('⚠️ Netlify Hook URL not configured yet.');
      setTimeout(() => { setSyncMessage(''); setIsSyncing(false); }, 4000);
      return;
    }

    try {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        setSyncMessage('🔄 Re-indexing local development rows...');
        const localResponse = await fetch('http://localhost:5174/api/fetch-sheets-now', { method: 'POST' });
        if (localResponse.ok) {
          setSyncMessage('✅ Localhost synchronized! Reloading view matrices...');
          setTimeout(() => window.location.reload(), 1200);
          return;
        }
      }

      await fetch(PRODUCTION_BUILD_HOOK, { 
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' }
      });
      
      setSyncMessage('🚀 Sync triggered safely! Netlify production servers will refresh in ~1-2 mins.');
    } catch (err) {
      setSyncMessage('❌ Sync operation timed out.');
    }
    
    setTimeout(() => { setSyncMessage(''); setIsSyncing(false); }, 6000);
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
    } catch (err) {
      setAuthError('Authentication cancelled or intercepted by security boundaries.');
    }
  };

  const toggleVisibilitySetting = async (keyName) => {
    const docRef = doc(db, 'app_settings', 'visibility');
    await updateDoc(docRef, {
      [keyName]: !hiddenItems[keyName]
    });
  };

  const handleThemeChange = async (field, value) => {
    const docRef = doc(db, 'app_theme', 'colors');
    await updateDoc(docRef, {
      [field]: value
    });
  };

  // --- DATA CLUSTERING AND CROSS-PLATFORM INTERACTION INJECTOR ---
  const groupedCategories = {};
  rawRows.slice(1).forEach((row, originalIndex) => {
    const categoryName = row[0] ? row[0].trim() : 'General Specifications';
    const featureName = row[1];

    if (!featureName) return; 
    if (hiddenItems[featureName] && !isAdminView) return; 

    if (!groupedCategories[categoryName]) {
      groupedCategories[categoryName] = [];
    }

    groupedCategories[categoryName].push({
      featureName,
      rowData: row,
      id: originalIndex
    });
  });

  const savedTabOrder = categoryOrder[activeTab] || [];
  const extractedCategories = Object.keys(groupedCategories);
  
  const finalCategorySequence = [...savedTabOrder];
  extractedCategories.forEach(cat => {
    if (!finalCategorySequence.includes(cat)) {
      finalCategorySequence.push(cat);
    }
  });
  const activeSortedCategories = finalCategorySequence.filter(cat => extractedCategories.includes(cat));

  // Dynamically map internal spec row sequences based on saved Firestore feature maps
  activeSortedCategories.forEach(catName => {
    const savedFeatureSequence = featureOrder[`${activeTab}__${catName}`] || [];
    const elements = groupedCategories[catName] || [];

    elements.sort((a, b) => {
      const indexA = savedFeatureSequence.indexOf(a.featureName);
      const indexB = savedFeatureSequence.indexOf(b.featureName);
      
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.id - b.id; // Fallback to raw spreadsheet index
    });
  });

  // --- DRAG AND DROP HANDLERS FOR CATEGORIES & INDIVIDUAL FEATURES ---
  const handleCategoryDragStart = (idx) => {
    setDraggedCategoryIdx(idx);
  };

  const handleCategoryDrop = async (targetIdx) => {
    if (draggedCategoryIdx === null || draggedCategoryIdx === targetIdx) return;
    
    const reorderedCategories = [...activeSortedCategories];
    const [movedItem] = reorderedCategories.splice(draggedCategoryIdx, 1);
    reorderedCategories.splice(targetIdx, 0, movedItem);

    setDraggedCategoryIdx(null);

    const docRef = doc(db, 'app_settings', 'category_order');
    await setDoc(docRef, {
      ...categoryOrder,
      [activeTab]: reorderedCategories
    }, { merge: true });
  };

  const handleFeatureDragStart = (categoryName, index) => {
    setDraggedFeatureInfo({ category: categoryName, index: index });
  };

  const handleFeatureDrop = async (categoryName, targetIndex) => {
    if (!draggedFeatureInfo || draggedFeatureInfo.category !== categoryName || draggedFeatureInfo.index === targetIndex) return;

    const targetList = [...groupedCategories[categoryName]];
    const [movedFeature] = targetList.splice(draggedFeatureInfo.index, 1);
    targetList.splice(targetIndex, 0, movedFeature);

    setDraggedFeatureInfo(null);

    const freshStringSequence = targetList.map(item => item.featureName);
    const docRef = doc(db, 'app_settings', 'feature_order');
    await setDoc(docRef, {
      ...featureOrder,
      [`${activeTab}__${categoryName}`]: freshStringSequence
    }, { merge: true });
  };

  // Global Scoping Metrics — MUST SIT ABOVE THE ADMIN CONDITIONAL BLOCKS FOR THE PUBLIC TABLE TO READ THEM
  const isAnyFilterActive = filterModes.length > 0 || filterThroughput !== 'all' || filterOptics.length > 0 || filterMag !== 'all';

  const handleClearAllFilters = () => {
    setFilterModes([]);
    setThroughput('all');
    setFilterOptics([]);
    setFilterMag('all');
  };

  const handleLogout = () => {
    signOut(auth);
  };

  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    setIsAdminView(path === '/admin');
  };

  const generateSelfResizingIframeSnippet = (targetUrl, uniqueElementId) => {
    return `<iframe \n  id="${uniqueElementId}" \n  src="${targetUrl}" \n  width="100%" \n  style="border:none; overflow:hidden; min-height:500px;" \n  scrolling="no"\n></iframe>`;
  };

  // ==================== VIEW A: THE ADMIN PORTAL DASHBOARD ====================
  if (isAdminView) {
    if (!user) {
      return (
        <div style={{ maxWidth: '420px', margin: '120px auto', padding: '40px', border: '1px solid #e2e8f0', borderRadius: '12px', fontFamily: 'system-ui, sans-serif', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', background: '#fff', textAlign: 'center' }}>
          <span style={{ fontSize: '44px', display: 'block', marginBottom: '16px' }}>🔒</span>
          <h2 style={{ marginTop: '0', marginBottom: '8px', color: '#0f172a', fontWeight: '800', letterSpacing: '-0.02em' }}>Control Console Login</h2>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 28px 0', lineHeight: '1.4' }}>Authentication is restricted exclusively to validated corporate administrators.</p>
          
          <button 
            onClick={handleGoogleSignIn}
            style={{ 
              width: '100%', padding: '12px', backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'background-color 0.15s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.61c-.29 1.53-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-8.58z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.11 0-5.74-2.11-6.68-4.96H1.21v3.15C3.18 21.88 7.31 24 12 24z"/>
              <path fill="#FBBC05" d="M5.32 14.24A7.16 7.16 0 0 1 5 12c0-.79.13-1.57.32-2.34V6.51H1.21A11.94 11.94 0 0 0 0 12c0 1.92.45 3.74 1.21 5.39l4.11-3.15z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0 7.31 0 3.18 2.12 1.21 5.39l4.11 3.15c.94-2.85 3.57-4.96 6.68-4.96z"/>
            </svg>
            Sign in with DeNovix Google Workspace
          </button>

          {authError && (
            <div style={{ marginTop: '20px', padding: '12px', background: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca' }}>
              <p style={{ color: '#dc2626', margin: '0', fontSize: '13px', fontWeight: '500', lineHeight: '1.4' }}>{authError}</p>
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '28px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
            <button onClick={() => navigateTo('/')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}>← Return to Specifications Matrix</button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh', color: '#0f172a' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', paddingBottom: '20px', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '32px' }}>⚙️</span>
            <div>
              <h1 style={{ margin: '0', fontSize: '26px', fontWeight: '800', tracking: '-0.02em', lineHeight: '1.2' }}>Master Specifications Control Panel</h1>
              <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: '14px' }}>Manage visibility metrics and structure the layouts for your specs tables.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#fff', padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            {syncMessage && <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>{syncMessage}</span>}
            <button 
              disabled={isSyncing}
              onClick={triggerGoogleSheetsSync} 
              style={{ padding: '10px 20px', backgroundColor: isSyncing ? '#94a3b8' : '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', cursor: isSyncing ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 4px rgba(34,197,94,0.15)', opacity: isSyncing ? 0.8 : 1 }}
            >
              <span>{isSyncing ? '⌛' : '🔄'}</span> {isSyncing ? 'Publishing...' : 'Synch Google Sheet'}
            </button>
            <button onClick={() => navigateTo('/')} style={{ padding: '10px 18px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', color: '#334155' }}>👁️ View Public Matrix</button>
            <button onClick={handleLogout} style={{ padding: '10px 18px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>Logout</button>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '28px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <h3 style={{ margin: '0 0 24px 0', color: '#0f172a', fontSize: '18px', fontWeight: '700' }}>🎨 Brand Design & Typography Configuration</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Typography Stack</label>
              <select 
                value={theme.fontFamily || ''} 
                onChange={(e) => handleThemeChange('fontFamily', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', outline: 'none' }}
              >
                {FONT_OPTIONS.map(font => (
                  <option key={font.value} value={font.value}>{font.label}</option>
                ))}
              </select>
            </div>

            {[
              { id: 'primary', label: 'Primary Theme Accent', val: theme.primary },
              { id: 'secondary', label: 'Table Header BG Accents', val: theme.secondary },
              { id: 'fontColor', label: 'Specification Font Color', val: theme.fontColor },
              { id: 'headerFontColor', label: 'Table Header Font Color', val: theme.headerFontColor }
            ].map(item => (
              <div key={item.id}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>{item.label}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8fafc' }}>
                  <input type="color" value={item.val || '#ffffff'} onChange={(e) => handleThemeChange(item.id, e.target.value)} style={{ cursor: 'pointer', border: 'none', background: 'none', width: '34px', height: '34px', padding: '0' }} />
                  <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600', color: '#334155' }}>{item.val?.toUpperCase()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 🔗 WordPress Embed Code Generator Section */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700' }}>🔗 WordPress Dynamic Embed Code Generator</h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Copy these frame strings to deploy isolated segment tables into individual WordPress sub-pages. These snippets include a real-time resizing listener to adjust heights automatically.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>Master Comparison Grid View (All Tabs Active)</strong>
                <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace', marginTop: '4px' }}>{window.location.origin}/</div>
              </div>
              <button 
                onClick={() => {
                  const masterSnippet = generateSelfResizingIframeSnippet(`${window.location.origin}/`, 'denovix-master-frame');
                  navigator.clipboard.writeText(masterSnippet);
                  alert("Copied Auto-Resizing Master Framework snippet!");
                }}
                style={{ padding: '7px 14px', fontSize: '13px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
              >
                Copy Snippet
              </button>
            </div>

            {currentTabs.map((tab, idx) => {
              const targetedUrl = `${window.location.origin}/?tab=${encodeURIComponent(tab)}`;
              const cleaningRegexId = `denovix-tab-frame-${idx}`;
              
              return (
                <div key={tab} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>Isolated Layout View: {tab}</strong>
                    <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace', marginTop: '4px' }}>{targetedUrl}</div>
                  </div>
                  <button 
                    onClick={() => {
                      const dynamicSnippet = generateSelfResizingIframeSnippet(targetedUrl, cleaningRegexId);
                      navigator.clipboard.writeText(dynamicSnippet);
                      alert(`Copied auto-resizing layout snippet for ${tab}!`);
                    }}
                    style={{ padding: '7px 14px', fontSize: '13px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                  >
                    Copy Snippet
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
          {currentTabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '10px 18px', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap', backgroundColor: activeTab === tab ? '#0f172a' : '#e2e8f0', color: activeTab === tab ? '#fff' : '#334155' }}>{tab}</button>
          ))}
        </div>

        {/* --- THREE COLUMN ADMINISTRATIVE CONTROL CONTROL DECK --- */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px', alignItems: 'start' }}>
          
          {/* Column 1: Interactive Category Drag-and-Drop Sorter */}
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ marginTop: '0', marginBottom: '4px', fontSize: '16px', fontWeight: '700' }}>↕️ Drag Category Display Order</h3>
            <p style={{ margin: '0 0 16px 0', color: '#64748b', fontSize: '12px' }}>Click and hold a category block to change its vertical display rank inside the main tables layout.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activeSortedCategories.map((cat, idx) => (
                <div 
                  key={cat} 
                  draggable
                  onDragStart={() => handleCategoryDragStart(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleCategoryDrop(idx)}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', cursor: 'grab', transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                >
                  <span style={{ color: '#94a3b8', userSelect: 'none', fontSize: '16px' }}>☰</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Column Visibility Controller Module */}
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ marginTop: '0', marginBottom: '16px', fontSize: '16px', fontWeight: '700' }}>📦 Hide Product Columns</h3>
            <div style={{ display: 'flex', columnGap: '12px', flexDirection: 'column', gap: '12px' }}>
              {allProducts.map(product => (
                <label key={product} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: hiddenItems[product] ? '#ef4444' : '#0f172a', fontWeight: hiddenItems[product] ? '600' : '500', fontSize: '14px', padding: '10px', background: hiddenItems[product] ? '#fef2f2' : '#f8fafc', borderRadius: '8px', border: '1px solid', borderColor: hiddenItems[product] ? '#fecaca' : '#e2e8f0' }}>
                  <input type="checkbox" checked={!!hiddenItems[product]} onChange={() => toggleVisibilitySetting(product)} style={{ width: '16px', height: '16px' }} />
                  <span style={{ textDecoration: hiddenItems[product] ? 'line-through' : 'none' }}>{product} {hiddenItems[product] ? '(HIDDEN)' : '(VISIBLE)'}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Column 3: Multi-Level Advanced Specifications Row Sorter Engine */}
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ marginTop: '0', marginBottom: '4px', fontSize: '16px', fontWeight: '700' }}>✏️ Hide Specification Feature Rows</h3>
            <p style={{ margin: '0 0 16px 0', color: '#64748b', fontSize: '12px' }}>Uncheck a row to hide it. Click and drag the handle icon (☰) to shift its sorting display order inside that category block.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '550px', overflowY: 'auto' }}>
              {activeSortedCategories.map(catName => (
                <div key={catName} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', background: '#fff' }}>
                  <div style={{ background: '#f1f5f9', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '10px', textTransform: 'uppercase' }}>{catName}</div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(groupedCategories[catName] || []).map(({ featureName }, fIdx) => (
                      <div
                        key={featureName}
                        draggable
                        onDragStart={() => handleFeatureDragStart(catName, fIdx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleFeatureDrop(catName, fIdx)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: '6px', background: '#fafafa', border: '1px solid #f1f5f9'
                        }}
                      >
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: hiddenItems[featureName] ? '#ef4444' : '#334155', fontSize: '13px', width: '85%' }}>
                          <input type="checkbox" checked={!!hiddenItems[featureName]} onChange={() => toggleVisibilitySetting(featureName)} style={{ width: '15px', height: '15px' }} />
                          <span style={{ textDecoration: hiddenItems[featureName] ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{featureName}</span>
                        </label>
                        <span style={{ color: '#cbd5e1', cursor: 'grab', fontSize: '14px', padding: '0 4px', userSelect: 'none' }} title="Drag to reorder row">☰</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ==================== VIEW B: THE PUBLIC FRONTEND SPEC MATRIX ====================
  return (
    <div className="spec-container" style={{ padding: '24px', fontFamily: 'var(--font-family)', color: 'var(--font-color)', background: '#fff', minHeight: '100vh' }}>
      
      <style>{`
        @media print {
          .tabs-bar, .visitor-controls, header, footer, button, nav { display: none !important; }
          body, .spec-container { padding: 0 !important; margin: 0 !important; background: #fff !important; font-family: var(--font-family) !important; color: var(--font-color) !important; }
          div { overflow: visible !important; }
          table { width: 100% !important; border-collapse: collapse !important; font-size: 11px !important; }
          th, td { border: 1px solid #cbd5e1 !important; padding: 8px 10px !important; word-break: break-word !important; }
          th { color: var(--header-font-color) !important; background-color: var(--secondary-color) !important; }
          td { color: var(--font-color) !important; }
          .category-row { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      
      {!lockToTab && (
        <div className="tabs-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', borderBottom: '2px solid #f1f5f9', paddingBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
            {currentTabs.map(tabName => (
              <button 
                key={tabName}
                onClick={() => setActiveTab(tabName)}
                style={{
                  padding: '11px 22px',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-family)',
                  backgroundColor: activeTab === tabName ? 'var(--primary-color)' : '#f1f5f9',
                  color: activeTab === tabName ? '#fff' : '#475569',
                  transition: 'all 0.2s'
                }}
              >
                {tabName}
              </button>
            ))}
          </div>
          <button onClick={() => navigateTo('/admin')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-family)' }}>🔐 Admin Panel</button>
        </div>
      )}

      {/* 🔍 Premium Technical Capability Discovery Hub */}
      {(activeTab === 'Spectrophotometers / Fluorometers' || activeTab === 'Cell Counters') && (
        <div className="visitor-controls" style={{ 
          background: '#ffffff', 
          padding: '24px', 
          borderRadius: '12px', 
          marginBottom: '32px', 
          border: '1px solid #e2e8f0', 
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)' 
        }}>
          <h4 style={{ 
            margin: '0 0 20px 0', 
            color: 'var(--font-color)', 
            fontSize: '16px', 
            fontWeight: '700', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px' 
          }}>
            <span></span> Configure Instrumentation Requirements
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
            
            {/* === CONDITION A: Render Spectrophotometer Parameter Sliders === */}
            {activeTab === 'Spectrophotometers / Fluorometers' && (
              <>
                {/* Line 1: Modes */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {['Microvolume UV-Vis', 'Cuvette UV-Vis', 'Fluorescence'].map(mode => {
                    const isSelected = filterModes.includes(mode);
                    return (
                      <button
                        key={mode}
                        onClick={() => {
                          if (isSelected) {
                            setFilterModes(filterModes.filter(m => m !== mode));
                          } else {
                            setFilterModes([...filterModes, mode]);
                          }
                        }}
                        style={{
                          padding: '10px 18px',
                          borderRadius: '20px',
                          border: '1px solid',
                          borderColor: isSelected ? 'var(--primary-color)' : '#cbd5e1',
                          backgroundColor: isSelected ? 'var(--primary-color)' : '#f8fafc',
                          color: isSelected ? '#ffffff' : '#334155',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s'
                        }}
                      >
                        {isSelected ? '✓' : '+'} {mode}
                      </button>
                    );
                  })}
                </div>

                {/* Line 2: Throughput Capacity */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'All Capacities', value: 'all' },
                    { label: 'Single Sample (Standard)', value: 'single' },
                    { label: 'Multi-Sample (8-Well)', value: 'multi' }
                  ].map(opt => {
                    const isSelected = filterThroughput === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setThroughput(opt.value)}
                        style={{
                          padding: '10px 18px',
                          borderRadius: '20px',
                          border: '1px solid',
                          borderColor: isSelected ? 'var(--primary-color)' : '#cbd5e1',
                          backgroundColor: isSelected ? 'var(--primary-color)' : '#f8fafc',
                          color: isSelected ? '#ffffff' : '#334155',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* === CONDITION B: Render Cell Counter Parameter Sliders === */}
            {activeTab === 'Cell Counters' && (
              <>
                {/* Line 1: Optical Modes */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {['Brightfield', 'Fluorescence'].map(optic => {
                    const isSelected = filterOptics.includes(optic);
                    return (
                      <button
                        key={optic}
                        onClick={() => {
                          if (isSelected) {
                            setFilterOptics(filterOptics.filter(o => o !== optic));
                          } else {
                            setFilterOptics([...filterOptics, optic]);
                          }
                        }}
                        style={{
                          padding: '10px 18px',
                          borderRadius: '20px',
                          border: '1px solid',
                          borderColor: isSelected ? 'var(--primary-color)' : '#cbd5e1',
                          backgroundColor: isSelected ? 'var(--primary-color)' : '#f8fafc',
                          color: isSelected ? '#ffffff' : '#334155',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s'
                        }}
                      >
                        {isSelected ? '✓' : '+'} {optic} Optics
                      </button>
                    );
                  })}
                </div>

                {/* Line 2: Magnification Settings */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'All Magnifications', value: 'all' },
                    { label: 'Standard Magnification', value: 'standard' },
                    { label: 'High Magnification', value: 'high' }
                  ].map(opt => {
                    const isSelected = filterMag === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setFilterMag(opt.value)}
                        style={{
                          padding: '10px 18px',
                          borderRadius: '20px',
                          border: '1px solid',
                          borderColor: isSelected ? 'var(--primary-color)' : '#cbd5e1',
                          backgroundColor: isSelected ? 'var(--primary-color)' : '#f8fafc',
                          color: isSelected ? '#ffffff' : '#334155',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

          </div>

          {/* Bottom Action Strip Controls Frame */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '16px', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
              Identified <strong>{productsToRender.length}</strong> optimal matrix configuration matches
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {isAnyFilterActive && (
                <button onClick={handleClearAllFilters} style={{ padding: '9px 16px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#64748b', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Clear Selections</button>
              )}
              <button onClick={handlePrint} style={{ padding: '10px 22px', backgroundColor: '#0D1EA0', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'var(--font-family)', boxShadow: '0 1px 3px rgba(17, 35, 225, 0.1)' }}>🖨️ Export / Print </button>
            </div>
          </div>
        </div>
      )}

      {/* Render Balanced Data Matrix Layout */}
      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
        <table id="spec-matrix-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px', lineHeight: '1.5' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--secondary-color)' }}>
              <th style={{ padding: '16px', borderBottom: '2px solid #cbd5e1', color: 'var(--header-font-color)', fontWeight: '700', width: '25%' }}>{featureLabel}</th>
              {productsToRender.map(product => {
                const meta = PRODUCT_METADATA[product];
                const isOptionallyFluorescent = activeTab === 'Spectrophotometers / Fluorometers' && filterModes.includes('Fluorescence') && meta?.optionalModes.includes('Fluorescence');

                return (
                  <th key={product} style={{ padding: '16px', borderBottom: '2px solid #cbd5e1', color: 'var(--header-font-color)', fontWeight: '700' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span>{product}</span>
                      {isOptionallyFluorescent && (
                        <span style={{ fontSize: '10px', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', width: 'fit-content', fontWeight: '700', textTransform: 'uppercase' }}>
                          *With Add-on Module
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {activeSortedCategories.map((categoryName) => {
              const categoryRows = groupedCategories[categoryName] || [];
              const visibleRows = categoryRows.filter(({ featureName }) => !hiddenItems[featureName]);
              if (visibleRows.length === 0) return null;

              return (
                <React.Fragment key={categoryName}>
                  <tr className="category-row" style={{ backgroundColor: '#f1f5f9' }}>
                    <td 
                      colSpan={productsToRender.length + 1} 
                      style={{ padding: '14px 16px', fontWeight: '800', color: 'var(--header-font-color)', borderBottom: '1px solid #cbd5e1', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.06em' }}
                    >
                      {categoryName}
                    </td>
                  </tr>

                  {visibleRows.map(({ featureName, rowData, id }) => (
                    <tr key={`row-${id}`} style={{ borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                      <td style={{ padding: '14px 16px', fontWeight: '600', color: 'var(--font-color)', verticalAlign: 'top', background: '#fafafa' }}>
                        {featureName}
                      </td>
                      {headers.slice(2).map((productName, colIndex) => {
                        if (!productsToRender.includes(productName)) return null;
                        return (
                          <td key={colIndex} style={{ padding: '14px 16px', color: 'var(--font-color)', verticalAlign: 'top' }}>
                            {rowData[colIndex + 2] || '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;