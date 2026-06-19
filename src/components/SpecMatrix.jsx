import React, { useState, useEffect } from 'react';
import { PRODUCT_METADATA } from '../config/products';
import FilterControls from './FilterControls';

const mdLink = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/;
const bareUrl = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/;

function renderCell(value) {
  if (!value) return '—';
  const md = mdLink.exec(value.trim());
  if (md) return <a href={md[2]} target="_blank" rel="noreferrer">{md[1]}</a>;
  const v = value.trim();
  if (bareUrl.test(v)) {
    const href = /^https?:\/\//.test(v) ? v : `https://${v}`;
    return <a href={href} target="_blank" rel="noreferrer">{v}</a>;
  }
  return value;
}

export default function SpecMatrix({
  allProducts,
  headers,
  featureLabel,
  activeTab,
  lockToTab,
  currentTabs,
  setActiveTab,
  navigateTo,
  groupedCategories,
  activeSortedCategories,
  hiddenItems,
  isEmbed = false,
}) {
  const [filterModes, setFilterModes] = useState([]);
  const [filterThroughput, setFilterThroughput] = useState('all');
  const [filterOptics, setFilterOptics] = useState([]);
  const [filterMag, setFilterMag] = useState('all');
  const [lastTab, setLastTab] = useState(activeTab);

  // Reset filters synchronously during render when the tab changes (avoids setState-in-effect).
  if (lastTab !== activeTab) {
    setLastTab(activeTab);
    setFilterModes([]);
    setFilterThroughput('all');
    setFilterOptics([]);
    setFilterMag('all');
  }

  // Report rendered height to parent iframe on mount and tab change.
  // Skipped in embed mode where the content lives in the page's own scroll context.
  useEffect(() => {
    if (isEmbed) return;
    const reportHeight = () => {
      const height = document.documentElement.scrollHeight || document.body.scrollHeight;
      window.parent.postMessage({ type: 'RESIZE_IFRAME', height }, 'https://www.denovix.com');
    };
    reportHeight();
    const observer = new ResizeObserver(reportHeight);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [activeTab, isEmbed]);

  const visibleProducts = allProducts.filter(product => !hiddenItems[product]);

  const productsToRender = visibleProducts.filter(product => {
    const meta = PRODUCT_METADATA[product] || { type: 'fallback' };
    if (meta.type === 'fallback') return true;

    if (activeTab === 'Spectrophotometers / Fluorometers' && meta.type === 'spec') {
      const capabilities = [...meta.modes, ...meta.optionalModes];
      if (filterModes.length > 0 && !filterModes.every(m => capabilities.includes(m))) return false;
      if (filterThroughput === 'single' && meta.multi) return false;
      if (filterThroughput === 'multi' && !meta.multi) return false;
    }

    if (activeTab === 'Cell Counters' && meta.type === 'counter') {
      if (filterOptics.length > 0) {
        const hasMatch = filterOptics.every(optic => meta.optics?.includes(optic));
        if (!hasMatch) return false;
      }
      if (filterMag === 'standard' && !meta.magnification?.includes('Standard Magnification')) return false;
      if (filterMag === 'high' && !meta.magnification?.includes('High Magnification')) return false;
    }

    return true;
  });

  const isAnyFilterActive = filterModes.length > 0 || filterThroughput !== 'all' || filterOptics.length > 0 || filterMag !== 'all';
  const showFilters = activeTab === 'Spectrophotometers / Fluorometers' || activeTab === 'Cell Counters' || activeTab === 'Squid Pipette';

  return (
    <div className="spec-container" style={{ padding: '24px', fontFamily: 'var(--font-family)', color: 'var(--font-color)', background: '#fff', minHeight: isEmbed ? undefined : '100vh' }}>

      <style>{`
        /* --- Sticky first column --- */
        #spec-matrix-table thead th {
          position: sticky;
          top: 0;
          z-index: 2;
          background-color: var(--secondary-color);
        }
        #spec-matrix-table thead th:first-child {
          z-index: 3;
        }
        #spec-matrix-table tbody tr:not(.category-row) td:first-child {
          position: sticky;
          left: 0;
          z-index: 1;
          background-color: #fafafa;
          box-shadow: 2px 0 6px -2px rgba(0, 0, 0, 0.06);
        }

        /* --- Row backgrounds (moved out of inline styles so hover can override) --- */
        #spec-matrix-table tbody tr.data-row {
          background-color: #fff;
        }

        /* --- Row hover --- */
        #spec-matrix-table tbody tr.data-row:hover {
          background-color: #f0f5ff;
        }
        #spec-matrix-table tbody tr.data-row:hover td:first-child {
          background-color: #e8efff;
        }

        /* --- Print --- */
        @media print {
          .tabs-bar, .visitor-controls, header, footer, button, nav { display: none !important; }
          body, .spec-container { padding: 0 !important; margin: 0 !important; background: #fff !important; font-family: var(--font-family) !important; color: var(--font-color) !important; }
          div { overflow: visible !important; }
          table { width: 100% !important; border-collapse: collapse !important; font-size: 11px !important; }
          th, td { border: 1px solid #cbd5e1 !important; padding: 8px 10px !important; word-break: break-word !important; position: static !important; box-shadow: none !important; }
          th { color: var(--header-font-color) !important; background-color: var(--secondary-color) !important; }
          td { color: var(--font-color) !important; }
          .category-row { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          tbody tr.data-row td:first-child { background-color: transparent !important; }
        }
      `}</style>

      {!lockToTab && (
        <div className="tabs-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', borderBottom: '2px solid #f1f5f9', paddingBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
            {currentTabs.map(tabName => (
              <button
                key={tabName}
                onClick={() => setActiveTab(tabName)}
                style={{ padding: '11px 22px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', whiteSpace: 'nowrap', fontFamily: 'var(--font-family)', backgroundColor: activeTab === tabName ? 'var(--primary-color)' : '#f1f5f9', color: activeTab === tabName ? '#fff' : '#475569', transition: 'all 0.2s' }}
              >
                {tabName}
              </button>
            ))}
          </div>
          <button onClick={() => navigateTo('/admin')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-family)' }}>
            🔐 Admin Panel
          </button>
        </div>
      )}

      {showFilters && (
        <FilterControls
          activeTab={activeTab}
          filterModes={filterModes}
          filterThroughput={filterThroughput}
          filterOptics={filterOptics}
          filterMag={filterMag}
          setFilterModes={setFilterModes}
          setFilterThroughput={setFilterThroughput}
          setFilterOptics={setFilterOptics}
          setFilterMag={setFilterMag}
          productsToRender={productsToRender}
          isAnyFilterActive={isAnyFilterActive}
          onClearFilters={() => {
            setFilterModes([]);
            setFilterThroughput('all');
            setFilterOptics([]);
            setFilterMag('all');
          }}
          onPrint={() => window.print()}
        />
      )}

      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
        <table id="spec-matrix-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px', lineHeight: '1.5' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--secondary-color)' }}>
              <th style={{ padding: '16px', borderBottom: '2px solid #cbd5e1', color: 'var(--header-font-color)', fontWeight: '700', width: '25%' }}>{featureLabel}</th>
              {productsToRender.map(product => {
                const meta = PRODUCT_METADATA[product];
                const isOptionalFluorescence =
                  activeTab === 'Spectrophotometers / Fluorometers' &&
                  filterModes.includes('Fluorescence') &&
                  meta?.optionalModes?.includes('Fluorescence');
                return (
                  <th key={product} style={{ padding: '16px', borderBottom: '2px solid #cbd5e1', color: 'var(--header-font-color)', fontWeight: '700' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span>{product}</span>
                      {isOptionalFluorescence && (
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
            {activeSortedCategories.map(categoryName => {
              const visibleRows = (groupedCategories[categoryName] || [])
                .filter(({ featureName }) => !hiddenItems[featureName]);
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
                    <tr key={`row-${id}`} className="data-row" style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '14px 16px', fontWeight: '600', color: 'var(--font-color)', verticalAlign: 'top' }}>
                        {featureName}
                      </td>
                      {headers.slice(2).map((productName, colIndex) => {
                        if (!productsToRender.includes(productName)) return null;
                        return (
                          <td key={colIndex} style={{ padding: '14px 16px', color: 'var(--font-color)', verticalAlign: 'top', whiteSpace: 'pre-wrap' }}>
                            {renderCell(rowData[colIndex + 2])}
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
