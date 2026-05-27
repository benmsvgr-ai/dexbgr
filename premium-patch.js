/* ============================================================
   BOGORDEX PREMIUM BRIGHT — JS Map Patch
   Pokemon GO style: bright roads, colorful buildings, vivid portals
   ============================================================ */
(function () {
  'use strict';

  function waitForMap(cb, tries) {
    tries = tries || 0;
    if (window.map && typeof window.map.on === 'function') { cb(); }
    else if (tries < 80) { setTimeout(function(){ waitForMap(cb, tries+1); }, 200); }
  }

  waitForMap(function () {
    var m = window.map;
    function onLoad() {
      try { applyBrightMap(); } catch(e){ console.warn('[premium-bright] patch error', e); }
    }
    if (m.isStyleLoaded()) { onLoad(); }
    else { m.once('load', onLoad); }
    m.on('styledata', function(){ setTimeout(onLoad, 300); });
  });

  function applyBrightMap() {
    var m = window.map;
    if (!m || !m.getStyle) return;
    var style = m.getStyle();
    var layers = style.layers || [];

    /* ── 1. Map base tone: Pokemon GO bright ── */
    layers.forEach(function(layer) {
      var id = String(layer.id || '').toLowerCase();
      try {
        if (layer.type === 'background') {
          m.setPaintProperty(layer.id, 'background-color', '#d4e8f7');
        }
        if (layer.type === 'fill') {
          if (id.includes('water')) m.setPaintProperty(layer.id, 'fill-color', '#7ecef4');
          if (id.includes('park') || id.includes('grass') || id.includes('wood')) {
            try { m.setPaintProperty(layer.id, 'fill-color', '#b5dfa0'); } catch(e){}
            try { m.setPaintProperty(layer.id, 'fill-opacity', 0.90); } catch(e){}
          }
          if (id.includes('landuse') && !id.includes('park')) {
            try { m.setPaintProperty(layer.id, 'fill-color', '#c8e0ff'); } catch(e){}
          }
        }
        if (layer.type === 'line') {
          if (id.includes('motorway') || id.includes('trunk') || id.includes('primary')) {
            try { m.setPaintProperty(layer.id, 'line-color', '#ffa040'); } catch(e){}
            try { m.setPaintProperty(layer.id, 'line-opacity', 1.0); } catch(e){}
          } else if (id.includes('road') || id.includes('street') || id.includes('transport')) {
            try { m.setPaintProperty(layer.id, 'line-color', '#ffffff'); } catch(e){}
            try { m.setPaintProperty(layer.id, 'line-opacity', 0.95); } catch(e){}
          }
        }
      } catch(e){}
    });

    /* ── 2. Ghost buildings: bright translucent blue-violet ── */
    if (m.getLayer('bdx-ghost-buildings')) {
      try {
        m.setPaintProperty('bdx-ghost-buildings', 'fill-extrusion-color', [
          'interpolate', ['linear'], ['zoom'],
          15, '#aaccff',
          17, '#9bb5ff',
          19, '#8ca4ff'
        ]);
        m.setPaintProperty('bdx-ghost-buildings', 'fill-extrusion-opacity', 0.52);
      } catch(e){}
    }

    /* ── 3. Route lines: vivid + thick ── */
    [
      ['route-k5-glow', '#ff8c00', 18, 0.32],
      ['route-k6-glow', '#4c9eff', 18, 0.32],
      ['route-run-glow','#00d46a', 16, 0.28]
    ].forEach(function(c){
      if (m.getLayer(c[0])) {
        try {
          m.setPaintProperty(c[0],'line-color',c[1]);
          m.setPaintProperty(c[0],'line-width',c[2]);
          m.setPaintProperty(c[0],'line-opacity',c[3]);
          m.setPaintProperty(c[0],'line-blur',8);
        } catch(e){}
      }
    });
    [
      ['route-k5-line', '#ff8c00', 6],
      ['route-k6-line', '#4c9eff', 6],
      ['route-run-line','#00d46a', 5]
    ].forEach(function(c){
      if (m.getLayer(c[0])) {
        try {
          m.setPaintProperty(c[0],'line-color',c[1]);
          m.setPaintProperty(c[0],'line-width',c[2]);
          m.setPaintProperty(c[0],'line-opacity',1.0);
        } catch(e){}
      }
    });

    /* ── 4. Portal ring: brighter ── */
    if (m.getLayer('nearest-poi-ring')) {
      try {
        m.setPaintProperty('nearest-poi-ring','circle-stroke-color','#4c7fff');
        m.setPaintProperty('nearest-poi-ring','circle-stroke-width', 5);
        m.setPaintProperty('nearest-poi-ring','circle-stroke-opacity', 1.0);
        m.setPaintProperty('nearest-poi-ring','circle-color','rgba(76,127,255,.08)');
      } catch(e){}
    }

    /* ── 5. Add bright road glow (street feel) ── */
    var sources = style.sources || {};
    var vectorSrc = Object.keys(sources).find(function(k){ return /openmaptiles|openfreemap|osm|vector/i.test(k); });
    if (vectorSrc) {
      if (!m.getLayer('bdx-road-glow-bright')) {
        try {
          m.addLayer({
            id: 'bdx-road-glow-bright',
            type: 'line',
            source: vectorSrc,
            'source-layer': 'transportation',
            minzoom: 16,
            paint: {
              'line-color': '#ffffff',
              'line-width': ['interpolate',['linear'],['zoom'], 16, 3, 19, 8],
              'line-opacity': 0.22,
              'line-blur': 6
            }
          });
        } catch(e){}
      }
    }
  }

  /* ── Subtle scanlines for hologram feel ── */
  (function() {
    var style = document.createElement('style');
    style.textContent =
      '.map-scanline-bright{position:absolute;inset:0;z-index:7;pointer-events:none;' +
      'background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(180,210,255,.022) 3px,rgba(180,210,255,.022) 4px);' +
      'animation:scanBright 10s linear infinite;}' +
      '@keyframes scanBright{from{background-position-y:0}to{background-position-y:60px}}';
    document.head.appendChild(style);
    var el = document.createElement('div');
    el.className = 'map-scanline-bright';
    var app = document.getElementById('app');
    if (app) app.appendChild(el);
  })();

})();
