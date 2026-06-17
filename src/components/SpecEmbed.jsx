import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import specData from '../assets/specData.json';
import SpecMatrix from './SpecMatrix';

export default function SpecEmbed({ tab }) {
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

    return () => {
      unsubTheme();
      unsubVisibility();
      unsubCategoryOrder();
      unsubFeatureOrder();
    };
  }, []);

  const rawRows = specData[tab] || [];

  if (rawRows.length === 0) {
    return (
      <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif', color: '#64748b' }}>
        No specifications found for tab "{tab}".
      </div>
    );
  }

  const headers = rawRows[0] || [];
  const featureLabel = headers[1] || 'Specifications';
  const allProducts = headers.slice(2);

  const groupedCategories = {};
  rawRows.slice(1).forEach((row, originalIndex) => {
    const categoryName = row[0]?.trim() || 'General Specifications';
    const featureName = row[1];
    if (!featureName) return;
    if (!groupedCategories[categoryName]) groupedCategories[categoryName] = [];
    groupedCategories[categoryName].push({ featureName, rowData: row, id: originalIndex });
  });

  const savedTabOrder = categoryOrder[tab] || [];
  const extractedCategories = Object.keys(groupedCategories);
  const finalSequence = [...savedTabOrder];
  extractedCategories.forEach(cat => { if (!finalSequence.includes(cat)) finalSequence.push(cat); });
  const activeSortedCategories = finalSequence.filter(cat => extractedCategories.includes(cat));

  activeSortedCategories.forEach(catName => {
    const savedOrder = featureOrder[`${tab}__${catName}`] || [];
    (groupedCategories[catName] || []).sort((a, b) => {
      const iA = savedOrder.indexOf(a.featureName);
      const iB = savedOrder.indexOf(b.featureName);
      if (iA !== -1 && iB !== -1) return iA - iB;
      if (iA !== -1) return -1;
      if (iB !== -1) return 1;
      return a.id - b.id;
    });
  });

  return (
    <SpecMatrix
      allProducts={allProducts}
      headers={headers}
      featureLabel={featureLabel}
      activeTab={tab}
      lockToTab={tab}
      currentTabs={Object.keys(specData)}
      setActiveTab={() => {}}
      navigateTo={() => {}}
      groupedCategories={groupedCategories}
      activeSortedCategories={activeSortedCategories}
      hiddenItems={hiddenItems}
      isEmbed
    />
  );
}
