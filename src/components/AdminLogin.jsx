export default function AdminLogin({ handleGoogleSignIn, authError, navigateTo }) {
  return (
    <div style={{ maxWidth: '420px', margin: '120px auto', padding: '40px', border: '1px solid #e2e8f0', borderRadius: '12px', fontFamily: 'system-ui, sans-serif', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', background: '#fff', textAlign: 'center' }}>
      <span style={{ fontSize: '44px', display: 'block', marginBottom: '16px' }}>🔒</span>
      <h2 style={{ marginTop: '0', marginBottom: '8px', color: '#0f172a', fontWeight: '800', letterSpacing: '-0.02em' }}>Control Console Login</h2>
      <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 28px 0', lineHeight: '1.4' }}>Authentication is restricted exclusively to validated corporate administrators.</p>

      <button
        onClick={handleGoogleSignIn}
        style={{ width: '100%', padding: '12px', backgroundColor: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'background-color 0.15s' }}
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
