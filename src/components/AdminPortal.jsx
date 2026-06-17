import { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { FONT_OPTIONS } from '../config/products';

export default function AdminPortal({
  theme,
  hiddenItems,
  allProducts,
  activeSortedCategories,
  groupedCategories,
  categoryOrder,
  featureOrder,
  currentTabs,
  activeTab,
  setActiveTab,
  toggleVisibilitySetting,
  handleThemeChange,
  handleLogout,
  navigateTo,
}) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [draggedCategoryIdx, setDraggedCategoryIdx] = useState(null);
  const [draggedFeatureInfo, setDraggedFeatureInfo] = useState(null);

  const triggerGoogleSheetsSync = async () => {
    setIsSyncing(true);
    setSyncMessage('📡 Broadcasting build token payload...');

    const PRODUCTION_BUILD_HOOK = import.meta.env.VITE_NETLIFY_BUILD_HOOK;

    if (!PRODUCTION_BUILD_HOOK) {
      setSyncMessage('⚠️ Netlify Hook URL not configured (VITE_NETLIFY_BUILD_HOOK).');
      setTimeout(() => { setSyncMessage(''); setIsSyncing(false); }, 4000);
      return;
    }

    try {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        setSyncMessage('🔄 Re-indexing local development rows...');
        const localResponse = await fetch('http://localhost:5174/api/fetch-sheets-now', { method: 'POST' });
        if (localResponse.ok) {
          setSyncMessage('✅ Localhost synchronized! Reloading...');
          setTimeout(() => window.location.reload(), 1200);
          return;
        }
      }

      await fetch(PRODUCTION_BUILD_HOOK, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' } });
      setSyncMessage('🚀 Sync triggered! Netlify will refresh in ~1-2 mins.');
    } catch {
      setSyncMessage('❌ Sync operation timed out.');
    }

    setTimeout(() => { setSyncMessage(''); setIsSyncing(false); }, 6000);
  };

  const handleCategoryDragStart = (idx) => setDraggedCategoryIdx(idx);

  const handleCategoryDrop = async (targetIdx) => {
    if (draggedCategoryIdx === null || draggedCategoryIdx === targetIdx) return;

    const reordered = [...activeSortedCategories];
    const [moved] = reordered.splice(draggedCategoryIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    setDraggedCategoryIdx(null);

    await setDoc(doc(db, 'app_settings', 'category_order'), {
      ...categoryOrder,
      [activeTab]: reordered,
    }, { merge: true });
  };

  const handleFeatureDragStart = (categoryName, index) => setDraggedFeatureInfo({ category: categoryName, index });

  const handleFeatureDrop = async (categoryName, targetIndex) => {
    if (!draggedFeatureInfo || draggedFeatureInfo.category !== categoryName || draggedFeatureInfo.index === targetIndex) return;

    const list = [...(groupedCategories[categoryName] || [])];
    const [moved] = list.splice(draggedFeatureInfo.index, 1);
    list.splice(targetIndex, 0, moved);
    setDraggedFeatureInfo(null);

    await setDoc(doc(db, 'app_settings', 'feature_order'), {
      ...featureOrder,
      [`${activeTab}__${categoryName}`]: list.map(item => item.featureName),
    }, { merge: true });
  };

  const EMBED_JS_URL = 'https://denovixspecs.netlify.app/spec-embed.js';

  const generateEmbedSnippet = (tab) =>
    `<div data-spec-tab="${tab}"></div>\n<script src="${EMBED_JS_URL}" defer></script>`;

  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh', color: '#0f172a' }}>

      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', paddingBottom: '20px', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '32px' }}>⚙️</span>
          <div>
            <h1 style={{ margin: '0', fontSize: '26px', fontWeight: '800', lineHeight: '1.2' }}>Master Specifications Control Panel</h1>
            <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: '14px' }}>Manage visibility metrics and structure the layouts for your specs tables.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#fff', padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          {syncMessage && <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>{syncMessage}</span>}
          <button
            disabled={isSyncing}
            onClick={triggerGoogleSheetsSync}
            style={{ padding: '10px 20px', backgroundColor: isSyncing ? '#94a3b8' : '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', cursor: isSyncing ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', opacity: isSyncing ? 0.8 : 1 }}
          >
            <span>{isSyncing ? '⌛' : '🔄'}</span> {isSyncing ? 'Publishing...' : 'Sync Google Sheet'}
          </button>
          <button onClick={() => navigateTo('/')} style={{ padding: '10px 18px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', color: '#334155' }}>👁️ View Public Matrix</button>
          <button onClick={handleLogout} style={{ padding: '10px 18px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>Logout</button>
        </div>
      </div>

      {/* Brand & Typography */}
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
            { id: 'primary',         label: 'Primary Theme Accent' },
            { id: 'secondary',       label: 'Table Header BG Accent' },
            { id: 'fontColor',       label: 'Specification Font Color' },
            { id: 'headerFontColor', label: 'Table Header Font Color' },
          ].map(({ id, label }) => (
            <div key={id}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>{label}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8fafc' }}>
                <input type="color" value={theme[id] || '#ffffff'} onChange={(e) => handleThemeChange(id, e.target.value)} style={{ cursor: 'pointer', border: 'none', background: 'none', width: '34px', height: '34px', padding: '0' }} />
                <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600', color: '#334155' }}>{theme[id]?.toUpperCase()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Embed Code Generator */}
      <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700' }}>🔗 WordPress Embed Snippets</h3>
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
          Paste one snippet per WordPress page. Each embeds directly into the page DOM — no iframe, no scroll issues.
          The <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', fontFamily: 'monospace' }}>spec-embed.js</code> script
          URL is the same on every page; only the <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', fontFamily: 'monospace' }}>data-spec-tab</code> value changes.
          New product lines appear here automatically when added to the sheet.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {currentTabs.map((tab) => (
            <EmbedRow
              key={tab}
              label={tab}
              snippet={generateEmbedSnippet(tab)}
              preview={`data-spec-tab="${tab}"`}
            />
          ))}
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
        {currentTabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '10px 18px', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap', backgroundColor: activeTab === tab ? '#0f172a' : '#e2e8f0', color: activeTab === tab ? '#fff' : '#334155' }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Three-column control deck */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px', alignItems: 'start' }}>

        {/* Column 1: Category order */}
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
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', cursor: 'grab', transition: 'background-color 0.15s' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
              >
                <span style={{ color: '#94a3b8', userSelect: 'none', fontSize: '16px' }}>☰</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Product column visibility */}
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

        {/* Column 3: Feature row visibility + order */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ marginTop: '0', marginBottom: '4px', fontSize: '16px', fontWeight: '700' }}>✏️ Hide Specification Feature Rows</h3>
          <p style={{ margin: '0 0 16px 0', color: '#64748b', fontSize: '12px' }}>Uncheck a row to hide it. Drag the ☰ handle to reorder within a category.</p>
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
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: '6px', background: '#fafafa', border: '1px solid #f1f5f9' }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: hiddenItems[featureName] ? '#ef4444' : '#334155', fontSize: '13px', width: '85%' }}>
                        <input type="checkbox" checked={!!hiddenItems[featureName]} onChange={() => toggleVisibilitySetting(featureName)} style={{ width: '15px', height: '15px' }} />
                        <span style={{ textDecoration: hiddenItems[featureName] ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{featureName}</span>
                      </label>
                      <span style={{ color: '#cbd5e1', cursor: 'grab', fontSize: '14px', padding: '0 4px', userSelect: 'none' }} title="Drag to reorder">☰</span>
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

function EmbedRow({ label, snippet, preview }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', flexWrap: 'wrap', gap: '12px' }}>
      <div>
        <strong style={{ fontSize: '14px', color: '#0f172a' }}>{label}</strong>
        <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace', marginTop: '4px' }}>{preview}</div>
      </div>
      <button
        onClick={handleCopy}
        style={{ padding: '7px 14px', fontSize: '13px', background: '#fff', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', minWidth: '110px' }}
      >
        {copied ? '✓ Copied!' : 'Copy Snippet'}
      </button>
    </div>
  );
}
