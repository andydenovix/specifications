export const PRODUCT_METADATA = {
  // Spectrophotometer lineup
  'DS-11 FX+': { type: 'spec', modes: ['Microvolume UV-Vis', 'Cuvette UV-Vis', 'Fluorescence'], optionalModes: [], multi: false },
  'DS-11 FX':  { type: 'spec', modes: ['Microvolume UV-Vis', 'Fluorescence'], optionalModes: [], multi: false },
  'DS-11+':    { type: 'spec', modes: ['Microvolume UV-Vis', 'Cuvette UV-Vis'], optionalModes: ['Fluorescence'], multi: false },
  'DS-11':     { type: 'spec', modes: ['Microvolume UV-Vis'], optionalModes: ['Fluorescence'], multi: false },
  'DS-8X':     { type: 'spec', modes: ['Microvolume UV-Vis'], optionalModes: ['Fluorescence'], multi: true },
  'DS-8X+':    { type: 'spec', modes: ['Microvolume UV-Vis', 'Cuvette UV-Vis'], optionalModes: ['Fluorescence'], multi: true },
  'DS-C':      { type: 'spec', modes: ['Cuvette UV-Vis'], optionalModes: ['Fluorescence'], multi: false },
  'QFX':       { type: 'spec', modes: ['Fluorescence'], optionalModes: [], multi: false },
  'Helium':    { type: 'spec', modes: ['Microvolume UV-Vis'], optionalModes: [], multi: false },
  'DS-7+':     { type: 'spec', modes: ['Microvolume UV-Vis', 'Cuvette UV-Vis'], optionalModes: [], multi: false },
  'DS-7':      { type: 'spec', modes: ['Microvolume UV-Vis'], optionalModes: [], multi: false },

  // Cell counter lineup
  'CellDrop FLi':  { type: 'counter', optics: ['Brightfield', 'Fluorescence'], magnification: ['Standard Magnification'] },
  'CellDrop FLxi': { type: 'counter', optics: ['Brightfield', 'Fluorescence'], magnification: ['High Magnification'] },
  'CellDrop BF':   { type: 'counter', optics: ['Brightfield'], magnification: ['Standard Magnification'] },
  'CellDrop BFx':  { type: 'counter', optics: ['Brightfield'], magnification: ['High Magnification'] },

  'default': { type: 'unknown', modes: [], optionalModes: [], optics: [], magnification: [] },
};

export const FONT_OPTIONS = [
  { label: 'System Sans (Default)', value: 'system-ui, -apple-system, sans-serif' },
  { label: 'Helvetica / Arial',     value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: 'Inter / Roboto',        value: '"Inter", "Roboto", "Segoe UI", sans-serif' },
  { label: 'Georgia / Serif',       value: 'Georgia, Cambria, "Times New Roman", Times, serif' },
  { label: 'Monospace Tech',        value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace' },
];
