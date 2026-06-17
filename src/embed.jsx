import { createRoot } from 'react-dom/client';
import SpecEmbed from './components/SpecEmbed';

function mount() {
  document.querySelectorAll('[data-spec-tab]').forEach((container) => {
    const tab = container.getAttribute('data-spec-tab');
    createRoot(container).render(<SpecEmbed tab={tab} />);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
