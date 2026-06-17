import { useState } from 'react';

const QUOTE_PAGE_URL = 'https://www.denovix.com/request-a-quote/';

// Maps activeTab name to the CF7 "select-product-line" option value
const CF7_PRODUCT_LINE = {
  'Spectrophotometers / Fluorometers': 'DS-Series Spectrophotometers / Fluorometers',
  'Cell Counters':                     'CellDrop Automated Cell Counters',
  'Squid Pipette':                     'Squid Full Range Pipette (1 - 1000 µL)',
};

// Maps spec sheet product names to the CF7 specific-product dropdown option values
const CF7_PRODUCT_OPTION = {
  'DS-11 FX+': 'DS-11 FX+ Microvolume / Cuvette Spectrophotometer plus Fluorescence',
  'DS-11 FX':  'DS-11 FX Microvolume Spectrophotometer plus Fluorescence',
  'DS-11+':    'DS-11+ Microvolume / Cuvette Spectrophotometer',
  'DS-11':     'DS-11 Microvolume Spectrophotometer',
  'DS-8X+':    'DS-8X+ Eight Channel Spectrophotometer plus Cuvette',
  'DS-8X':     'DS-8X Eight Channel Spectrophotometer',
  'DS-7+':     'DS-7+ Microvolume / Cuvette Spectrophotometer',
  'DS-7':      'DS-7 Microvolume Spectrophotometer',
  'Helium':    'Helium Spectrophotometer',
  'QFX':       'QFX Fluorometer',
  'DS-C':      'DS-C Cuvette Spectrophotometer',
  'CellDrop FLi':  'CellDrop FLi Automated Cell Counter (Dual Fluorescence & Brightfield, 4X Objective)',
  'CellDrop FLxi': 'CellDrop FLxi Automated Cell Counter (Dual Fluorescence & Brightfield, 10X Objective)',
  'CellDrop BF':   'CellDrop BF Automated Cell Counter (Brightfield, 4X Objective)',
  'CellDrop BFx':  'CellDrop BFx Automated Cell Counter (Brightfield, 10X Objective)',
};

const pillStyle = (isSelected) => ({
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
  transition: 'all 0.15s',
});

const divider = (
  <div style={{ width: '1px', alignSelf: 'stretch', background: '#e2e8f0', flexShrink: 0, margin: '0 2px' }} />
);

export default function FilterControls({
  activeTab,
  filterModes,
  filterThroughput,
  filterOptics,
  filterMag,
  setFilterModes,
  setFilterThroughput,
  setFilterOptics,
  setFilterMag,
  productsToRender,
  isAnyFilterActive,
  onClearFilters,
  onPrint,
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const activeCount =
    filterModes.length +
    (filterThroughput !== 'all' ? 1 : 0) +
    filterOptics.length +
    (filterMag !== 'all' ? 1 : 0);

  const toggleMode = (mode) =>
    setFilterModes(filterModes.includes(mode)
      ? filterModes.filter(m => m !== mode)
      : [...filterModes, mode]);

  const toggleOptic = (optic) =>
    setFilterOptics(filterOptics.includes(optic)
      ? filterOptics.filter(o => o !== optic)
      : [...filterOptics, optic]);

  const handleRequestQuote = () => {
    const params = new URLSearchParams();
    // Full product list — used to populate the comments field on the quote page
    params.set('spec_products', productsToRender.join(','));
    // Product line — drives the CF7 "select-product-line" dropdown
    const cfLine = CF7_PRODUCT_LINE[activeTab];
    if (cfLine) params.set('spec_line', cfLine);
    // First product drives the CF7 sub-dropdown; full list goes into the comment field
    if (productsToRender.length >= 1) {
      const cfProduct = CF7_PRODUCT_OPTION[productsToRender[0]];
      if (cfProduct) params.set('spec_product', cfProduct);
    }
    window.open(`${QUOTE_PAGE_URL}?${params.toString()}`, '_blank');
  };

  return (
    <div className="visitor-controls" style={{ background: '#ffffff', borderRadius: '12px', marginBottom: '32px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.02)', overflow: 'hidden' }}>

      {/* Clickable header — always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: isExpanded ? '1px solid #f1f5f9' : 'none' }}
      >
        <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--font-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🔍 Configure Instrumentation Requirements
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {!isExpanded && activeCount > 0 && (
            <span style={{ fontSize: '12px', background: 'var(--primary-color)', color: '#fff', borderRadius: '12px', padding: '2px 10px', fontWeight: '700' }}>
              {activeCount} active
            </span>
          )}
          <span style={{ color: '#94a3b8', fontSize: '18px', lineHeight: 1 }}>
            {isExpanded ? '▾' : '▸'}
          </span>
        </span>
      </button>

      {isExpanded && (
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>

            {/* === Spectrophotometers === */}
            {activeTab === 'Spectrophotometers / Fluorometers' && (
              <>
                {/* Measurement modes — "Any Mode" + divider + specific modes */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button onClick={() => setFilterModes([])} style={{ ...pillStyle(filterModes.length === 0), width: '170px', justifyContent: 'center' }}>
                    Any Mode
                  </button>
                  {divider}
                  {['Microvolume UV-Vis', 'Cuvette UV-Vis', 'Fluorescence'].map(mode => (
                    <button key={mode} onClick={() => toggleMode(mode)} style={pillStyle(filterModes.includes(mode))}>
                      {filterModes.includes(mode) ? '✓' : '+'} {mode}
                    </button>
                  ))}
                </div>

                {/* Sample throughput — "Any Sample Number" + divider + specific options */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button onClick={() => setFilterThroughput('all')} style={{ ...pillStyle(filterThroughput === 'all'), width: '170px', justifyContent: 'center' }}>
                    Any Sample Number
                  </button>
                  {divider}
                  {[
                    { label: 'Single Sample (Standard)', value: 'single' },
                    { label: 'Multi-Sample (8-Well)', value: 'multi' },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => setFilterThroughput(opt.value)} style={pillStyle(filterThroughput === opt.value)}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* === Cell Counters === */}
            {activeTab === 'Cell Counters' && (
              <>
                {/* Optics — "Any Optics" + divider + specific optics */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button onClick={() => setFilterOptics([])} style={{ ...pillStyle(filterOptics.length === 0), width: '170px', justifyContent: 'center' }}>
                    Any Optics
                  </button>
                  {divider}
                  {['Brightfield', 'Fluorescence'].map(optic => (
                    <button key={optic} onClick={() => toggleOptic(optic)} style={pillStyle(filterOptics.includes(optic))}>
                      {filterOptics.includes(optic) ? '✓' : '+'} {optic} Optics
                    </button>
                  ))}
                </div>

                {/* Magnification — "Any Magnification" + divider + specific options */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button onClick={() => setFilterMag('all')} style={{ ...pillStyle(filterMag === 'all'), width: '170px', justifyContent: 'center' }}>
                    Any Magnification
                  </button>
                  {divider}
                  {[
                    { label: 'Standard Magnification', value: 'standard' },
                    { label: 'High Magnification', value: 'high' },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => setFilterMag(opt.value)} style={pillStyle(filterMag === opt.value)}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}

          </div>

          {/* Bottom action strip */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ fontSize: '14px', color: '#475569', fontWeight: '700' }}>
              {productsToRender.length} Matching Models
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {isAnyFilterActive && (
                <button onClick={onClearFilters} style={{ padding: '9px 16px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#64748b', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                  Clear Selections
                </button>
              )}
              <button
                onClick={handleRequestQuote}
                style={{ padding: '10px 18px', backgroundColor: '#fff', color: 'var(--primary-color)', border: '1.5px solid var(--primary-color)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', fontFamily: 'var(--font-family)' }}
              >
                ✉ Request Quote
              </button>
              <button
                onClick={onPrint}
                style={{ padding: '10px 22px', backgroundColor: 'var(--primary-color)', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'var(--font-family)' }}
              >
                🖨️ Export / Print to PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
