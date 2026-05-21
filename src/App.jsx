import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc, setDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
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

  // Reads URL parameter to check if this embedded instance is locked to an isolated view
  const urlParams = new URLSearchParams(window.location.search);
  const lockToTab = urlParams.get('tab');

  const currentTabs = Object.keys(specData);
  
  // Initialize tab choice based on URL routing string or fallback to standard index 0
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

  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Sync state variables
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // Multi-parameter visitor filtering states for Spectrophotometers
  const [filterModes, setFilterModes] = useState([]); 
  const [filterThroughput, setThroughput] = useState('all'); 

  // Multi-parameter visitor filtering states for Cell Counters
  const [filterOptics, setFilterOptics] = useState([]);
  const [filterMag, setFilterMag] = useState('all');

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

    const unsubscribeOrder = onSnapshot(doc(db, 'app_settings', 'category_order'), (docSnap) => {
      if (docSnap.exists()) {
        setCategoryOrder(docSnap.data());
      }
    });

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => {
      unsubscribeTheme();
      unsubscribeVisibility();
      unsubscribeOrder();
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    // Keep user state active, but wipe interactive filters cleanly upon changing tabs
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

  // Dynamic Parameter Filter Engine (Smart Context Hybrid Routing Sorter)
  const productsToRender = visibleProducts.filter(product => {
    const meta = PRODUCT_METADATA[product] || { type: 'fallback' };
    if (meta.type === 'fallback') return true; 

    // --- Tab Scenario A: Spectrophotometer Logic Matrix ---
    if (activeTab === 'Spectrophotometers / Fluorometers' && meta.type === 'spec') {
      const totalCapabilities = [...meta.modes, ...meta.optionalModes];
      if (filterModes.length > 0) {
        const satisfiesAllSelections = filterModes.every(mode => totalCapabilities.includes(mode));
        if (!satisfiesAllSelections) return false; 
      }
      if (filterThroughput === 'single' && meta.multi) return false;
      if (filterThroughput === 'multi' && !meta.multi) return false;
    }

    // --- Tab Scenario B: Cell Counter Logic Matrix (Strict Exclusionary Capability) ---
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

  const handlePrint = () => {
    window.print();
  };

  // Triggers application pipeline to parse the Google Sheet data live on demand
  const triggerGoogleSheetsSync = async () => {
    setIsSyncing(true);
    setSyncMessage('📡 Fetching fresh spreadsheet data streams...');
    
    // Replace with your true Netlify or Vercel Build Hook URL string
    const PRODUCTION_BUILD_HOOK = "https://api.netlify.com/build_hooks/YOUR_NETLIFY_HOOK_ID";

    try {
      // Ping Production Server Pipeline
      const productionResponse = await fetch(PRODUCTION_BUILD_HOOK, { method: 'POST' });
      
      // If debugging locally on your computer, pull files directly to localhost environment
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        setSyncMessage('🔄 Re-indexing local data sheets...');
        const localResponse = await fetch('http://localhost:5174/api/fetch-sheets-now', { method: 'POST' });
        if (localResponse.ok) {
          setSyncMessage('✅ Localhost synchronized! Reloading table layouts...');
          setTimeout(() => window.location.reload(), 1500);
          return;
        }
      }

      if (productionResponse.ok) {
        setSyncMessage('🚀 Sync initiated successfully! Netlify will update live in ~1-2 minutes.');
      } else {
        setSyncMessage('❌ Cloud sync execution rejected.');
      }
    } catch (err) {
      setSyncMessage('❌ API Connection timed out.');
    }
    
    setTimeout(() => { setSyncMessage(''); setIsSyncing(false); }, 6000);
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

  // Data Grouping Engine
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

  const moveCategoryOrder = async (index, direction) => {
    const newOrder = [...activeSortedCategories];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    const docRef = doc(db, 'app_settings', 'category_order');
    await setDoc(docRef, {
      ...categoryOrder,
      [activeTab]: newOrder
    }, { merge: true });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setAuthError('Invalid administrator credentials. Access Denied.');
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    setIsAdminView(path === '/admin');
  };

  const isAnyFilterActive = filterModes.length > 0 || filterThroughput !== 'all' || filterOptics.length > 0 || filterMag !== 'all';

  const handleClearAllFilters = () => {
    setFilterModes([]);
    setThroughput('all');
    setFilterOptics([]);
    setFilterMag('all');
  };

  // ==================== VIEW A: THE ADMIN PORTAL DASHBOARD ====================
  if (isAdminView) {
    if (!user) {
      return (
        <div style={{ maxWidth: '420px', margin: '100px auto', padding: '40px', border: '1px solid #e2e8f0', borderRadius: '12px', fontFamily: 'system-ui, sans-serif', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', background: '#fff' }}>
          <h2 style={{ marginTop: '0', marginBottom: '24px', color: '#0f172a', fontWeight: '700', textAlign: 'center' }}>🔒 Admin Portal Access</h2>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '11px 14px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', fontSize: '14px' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '11px 14px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', fontSize: '14px' }} />
            </div>
            {authError && <p style={{ color: '#dc2626', margin: '0', fontSize: '13px', fontWeight: '500' }}>{authError}</p>}
            <button type="submit" style={{ padding: '12px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>Sign In</button>
          </form>
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button onClick={() => navigateTo('/')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px', textDecoration: 'underline' }}>← Back to Public Specs View</button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh', color: '#0f172a' }}>
        
        {/* Admin Header Action Strip Dashboard Panel */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', paddingBottom: '20px', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '32px' }}>⚙️</span>
            <div>
              <h1 style={{ margin: '0', fontSize: '26px', fontWeight: '800', tracking: '-0.02em', lineHeight: '1.2' }}>Master Specifications Control Panel</h1>
              <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: '14px' }}>Manage visibility metrics and structure the layouts for your specs tables.</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#f8fafc', padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            {syncMessage && <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>{syncMessage}</span>}
            <button 
              disabled={isSyncing}
              onClick={triggerGoogleSheetsSync} 
              style={{ padding: '10px 20px', backgroundColor: isSyncing ? '#94a3b8' : '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', cursor: isSyncing ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 4px rgba(34,197,94,0.15)', opacity: isSyncing ? 0.8 : 1 }}
            >
              <span>{isSyncing ? '⌛' : '🔄'}</span> {isSyncing ? 'Publishing...' : 'Publish Spreadsheet Updates Live'}
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

        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700' }}>🔗 WordPress Embed Code Generator</h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Copy these frame strings to deploy isolated segment tables into individual WordPress sub-pages.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifycontent: 'space-between', padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>Master Comparison Grid View (All Tabs Active)</strong>
                <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace', marginTop: '4px' }}>{window.location.origin}/</div>
              </div>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(`<iframe src="${window.location.origin}/" width="100%" height="900px" style="border:none;" scrolling="no"></iframe>`);
                  alert("Copied Master Framework Iframe string!");
                }}
                style={{ padding: '7px 14px', fontSize: '13px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
              >
                Copy Iframe Snippet
              </button>
            </div>

            {currentTabs.map(tab => {
              const targetedUrl = `${window.location.origin}/?tab=${encodeURIComponent(tab)}`;
              const iframeString = `<iframe src="${targetedUrl}" width="100%" height="900px" style="border:none;" scrolling="no"></iframe>`;
              
              return (
                <div key={tab} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>Isolated Layout View: {tab}</strong>
                    <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace', marginTop: '4px' }}>{targetedUrl}</div>
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(iframeString);
                      alert(`Copied layout snippet for ${tab}!`);
                    }}
                    style={{ padding: '7px 14px', fontSize: '13px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                  >
                    Copy Iframe Snippet
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px', alignItems: 'start' }}>
          
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ marginTop: '0', marginBottom: '8px', fontSize: '16px', fontWeight: '700' }}>↕️ Sort Category Display Order</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activeSortedCategories.map((cat, idx) => (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{cat}</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button disabled={idx === 0} onClick={() => moveCategoryOrder(idx, 'up')} style={{ padding: '5px 10px', fontSize: '12px', fontWeight: 'bold', cursor: idx === 0 ? 'not-allowed' : 'pointer', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff' }}>▲</button>
                    <button disabled={idx === activeSortedCategories.length - 1} onClick={() => moveCategoryOrder(idx, 'down')} style={{ padding: '5px 10px', fontSize: '12px', fontWeight: 'bold', cursor: idx === activeSortedCategories.length - 1 ? 'not-allowed' : 'pointer', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff' }}>▼</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ marginTop: '0', marginBottom: '16px', fontSize: '16px', fontWeight: '700' }}>📦 Hide Product Columns</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {allProducts.map(product => (
                <label key={product} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: hiddenItems[product] ? '#ef4444' : '#0f172a', fontWeight: hiddenItems[product] ? '600' : '500', fontSize: '14px', padding: '10px', background: hiddenItems[product] ? '#fef2f2' : '#f8fafc', borderRadius: '8px', border: '1px solid', borderColor: hiddenItems[product] ? '#fecaca' : '#e2e8f0' }}>
                  <input type="checkbox" checked={!!hiddenItems[product]} onChange={() => toggleVisibilitySetting(product)} style={{ width: '16px', height: '16px' }} />
                  <span style={{ textDecoration: hiddenItems[product] ? 'line-through' : 'none' }}>{product} {hiddenItems[product] ? '(HIDDEN)' : '(VISIBLE)'}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ marginTop: '0', marginBottom: '16px', fontSize: '16px', fontWeight: '700' }}>✏️ Hide Specification Feature Rows</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '550px', overflowY: 'auto' }}>
              {activeSortedCategories.map(catName => (
                <div key={catName} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', background: '#fff' }}>
                  <div style={{ background: '#f1f5f9', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '10px', textTransform: 'uppercase' }}>{catName}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(groupedCategories[catName] || []).map(({ featureName }) => (
                      <label key={featureName} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: hiddenItems[featureName] ? '#ef4444' : '#334155', fontSize: '13px' }}>
                        <input type="checkbox" checked={!!hiddenItems[featureName]} onChange={() => toggleVisibilitySetting(featureName)} style={{ width: '15px', height: '15px' }} />
                        <span style={{ textDecoration: hiddenItems[featureName] ? 'line-through' : 'none' }}>{featureName}</span>
                      </label>
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
            <span>⚡</span> Configure Instrumentation Requirements
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
              <button onClick={handlePrint} style={{ padding: '10px 22px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'var(--font-family)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>🖨️ Export / Print Matrix</button>
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