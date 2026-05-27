/* ============================================================
   BOGORDEX PREMIUM — JS Visual Patch (injected after app.js)
   Upgrades: 3D buildings vivid, camera pitch boost, portal particles,
   map tone overrides, ambient light bloom
   ============================================================ */
(function () {
  'use strict';

  /* ── Wait for map to be fully ready ── */
  function waitForMap(cb, tries) {
    tries = tries || 0;
    if (window.map && typeof window.map.on === 'function') {
      cb();
    } else if (tries < 80) {
      setTimeout(() => waitForMap(cb, tries + 1), 200);
    }
  }

  waitForMap(function () {
    const m = window.map;

    /* Listen for map style load */
    function onStyleLoad() {
      try { applyPremium3D(); } catch (e) { console.warn('[premium] 3D patch error', e); }
    }

    if (m.isStyleLoaded()) {
      onStyleLoad();
    } else {
      m.once('load', onStyleLoad);
    }
    m.on('styledata', function () {
      setTimeout(onStyleLoad, 300);
    });
  });

  function applyPremium3D() {
    const m = window.map;
    if (!m || !m.getStyle) return;
    const style = m.getStyle();
    const layers = style.layers || [];

    /* ── 1. Map tone: deeper, more game-like ── */
    layers.forEach(function (layer) {
      const id = String(layer.id || '').toLowerCase();
      try {
        if (layer.type === 'background') {
          m.setPaintProperty(layer.id, 'background-color', '#0a1428');
        }
        if (layer.type === 'fill') {
          if (id.includes('water')) m.setPaintProperty(layer.id, 'fill-color', '#0a3a6e');
          if (id.includes('park') || id.includes('grass') || id.includes('wood') || id.includes('landuse')) {
            try { m.setPaintProperty(layer.id, 'fill-color', '#0d2c1a'); } catch (e) {}
            try { m.setPaintProperty(layer.id, 'fill-opacity', 0.88); } catch (e) {}
          }
          if (id.includes('sand') || id.includes('beach')) {
            try { m.setPaintProperty(layer.id, 'fill-color', '#1a2c18'); } catch (e) {}
          }
        }
        if (layer.type === 'line') {
          if (id.includes('road') || id.includes('street') || id.includes('transport')) {
            try { m.setPaintProperty(layer.id, 'line-color', '#1a3a7a'); } catch (e) {}
            try { m.setPaintProperty(layer.id, 'line-opacity', 0.95); } catch (e) {}
          }
          if (id.includes('motorway') || id.includes('primary') || id.includes('trunk')) {
            try { m.setPaintProperty(layer.id, 'line-color', '#254aa8'); } catch (e) {}
          }
        }
      } catch (e) {}
    });

    /* ── 2. Ghost buildings: more vivid cyan towers ── */
    if (m.getLayer('bdx-ghost-buildings')) {
      try {
        m.setPaintProperty('bdx-ghost-buildings', 'fill-extrusion-color', [
          'interpolate', ['linear'], ['zoom'],
          15, '#0a3c5a',
          17, '#0d5880',
          19, '#1472a8'
        ]);
        m.setPaintProperty('bdx-ghost-buildings', 'fill-extrusion-opacity', 0.42);
        m.setPaintProperty('bdx-ghost-buildings', 'fill-extrusion-ambient-occlusion-intensity', 0.5);
      } catch (e) {}
    }

    /* ── 3. Add premium neon road glow ── */
    const sources = style.sources || {};
    const vectorSrc = Object.keys(sources).find(k => /openmaptiles|openfreemap|osm|vector/i.test(k));
    if (vectorSrc) {
      /* Neon road glow layer */
      if (!m.getLayer('bdx-road-neon-glow')) {
        try {
          m.addLayer({
            id: 'bdx-road-neon-glow',
            type: 'line',
            source: vectorSrc,
            'source-layer': 'transportation',
            minzoom: 16,
            paint: {
              'line-color': '#1e5fff',
              'line-width': ['interpolate', ['linear'], ['zoom'], 16, 4, 19, 10],
              'line-opacity': 0.18,
              'line-blur': 8
            }
          });
        } catch (e) {}
      }
      /* Neon ground fill for pedestrian areas */
      if (!m.getLayer('bdx-pedestrian-glow')) {
        try {
          m.addLayer({
            id: 'bdx-pedestrian-glow',
            type: 'fill',
            source: vectorSrc,
            'source-layer': 'transportation',
            filter: ['==', ['get', 'class'], 'path'],
            minzoom: 17,
            paint: {
              'fill-color': '#0a2858',
              'fill-opacity': 0.50
            }
          });
        } catch (e) {}
      }
    }

    /* ── 4. Brighten portal ring layers ── */
    ['nearest-poi-ring', 'portal-ring'].forEach(function (lid) {
      if (m.getLayer(lid)) {
        try { m.setPaintProperty(lid, 'circle-stroke-color', '#6be6ff'); } catch (e) {}
        try { m.setPaintProperty(lid, 'circle-stroke-width', 4); } catch (e) {}
        try { m.setPaintProperty(lid, 'circle-stroke-opacity', 1.0); } catch (e) {}
      }
    });

    /* ── 5. Route lines: more vivid ── */
    [
      ['route-k5-glow', '#ffc15d', 16, 0.28],
      ['route-k6-glow', '#7bc7ff', 16, 0.28],
      ['route-run-glow', '#67ebb2', 14, 0.24]
    ].forEach(function (cfg) {
      if (m.getLayer(cfg[0])) {
        try {
          m.setPaintProperty(cfg[0], 'line-color', cfg[1]);
          m.setPaintProperty(cfg[0], 'line-width', cfg[2]);
          m.setPaintProperty(cfg[0], 'line-opacity', cfg[3]);
          m.setPaintProperty(cfg[0], 'line-blur', 10);
        } catch (e) {}
      }
    });
    [
      ['route-k5-line', '#ffb04a', 5.5],
      ['route-k6-line', '#67b6ff', 5.5],
      ['route-run-line', '#49d08b', 4.2]
    ].forEach(function (cfg) {
      if (m.getLayer(cfg[0])) {
        try {
          m.setPaintProperty(cfg[0], 'line-color', cfg[1]);
          m.setPaintProperty(cfg[0], 'line-width', cfg[2]);
          m.setPaintProperty(cfg[0], 'line-opacity', 0.95);
        } catch (e) {}
      }
    });
  }

  /* ── Portal particle burst ── */
  function injectPortalParticles() {
    const style = document.createElement('style');
    style.textContent = `
      .portal-particle-ring {
        position: absolute;
        left: 50%; top: 50%;
        width: 0; height: 0;
        pointer-events: none;
        z-index: 13;
      }
      .portal-particle-ring::before,
      .portal-particle-ring::after {
        content: "";
        position: absolute;
        border-radius: 50%;
        transform: translate(-50%,-50%);
      }
      .portal-particle-ring::before {
        width: 120px; height: 120px;
        border: 2px solid rgba(107,230,255,.55);
        box-shadow: 0 0 18px rgba(107,230,255,.45), 0 0 40px rgba(107,230,255,.18);
        animation: portalRingPremium 2s linear infinite;
      }
      .portal-particle-ring::after {
        width: 72px; height: 72px;
        border: 1.5px dashed rgba(255,109,180,.45);
        box-shadow: 0 0 12px rgba(255,109,180,.35);
        animation: portalRingPremiumRev 3s linear infinite;
      }
      @keyframes portalRingPremium    { from { transform: translate(-50%,-50%) rotate(0deg); } to { transform: translate(-50%,-50%) rotate(360deg); } }
      @keyframes portalRingPremiumRev { from { transform: translate(-50%,-50%) rotate(0deg); } to { transform: translate(-50%,-50%) rotate(-360deg); } }
    `;
    document.head.appendChild(style);
  }
  injectPortalParticles();

  /* ── Ambient map scan lines ── */
  function injectScanLine() {
    const el = document.createElement('div');
    el.className = 'map-scanline-premium';
    el.style.cssText = `
      position:absolute; inset:0; z-index:7; pointer-events:none;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 3px,
        rgba(107,200,255,.018) 3px,
        rgba(107,200,255,.018) 4px
      );
      animation: scanlineScroll 8s linear infinite;
    `;
    const style = document.createElement('style');
    style.textContent = `@keyframes scanlineScroll { from { background-position-y: 0; } to { background-position-y: 80px; } }`;
    document.head.appendChild(style);
    const app = document.getElementById('app');
    if (app) app.appendChild(el);
  }
  injectScanLine();

})();
