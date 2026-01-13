/**
 * Spyglass Realty Property Search Widget
 * Embeddable property search for WordPress
 * 
 * Usage:
 *   <div id="spyglass-search"></div>
 *   <script src="https://YOUR_DOMAIN/spyglass-property-widget.js"></script>
 *   <script>
 *     SpyglassPropertySearch.init('spyglass-search', {
 *       apiUrl: 'https://YOUR_DOMAIN/api/widget'
 *     });
 *   </script>
 */

(function() {
  'use strict';

  const STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=Lato:wght@400;700&display=swap');

    .spyglass-widget {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #333;
      line-height: 1.5;
      box-sizing: border-box;
    }

    .spyglass-widget *, .spyglass-widget *::before, .spyglass-widget *::after {
      box-sizing: inherit;
    }

    .spyglass-header {
      background: #000000;
      color: white;
      padding: 16px 20px;
      border-radius: 8px 8px 0 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .spyglass-header-logo {
      height: 40px;
      width: auto;
    }

    .spyglass-header-content {
      flex: 1;
      text-align: right;
    }

    .spyglass-header h2 {
      margin: 0 0 2px 0;
      font-size: 1.25rem;
      font-weight: 600;
      font-family: 'Playfair Display', serif;
    }

    .spyglass-header p {
      margin: 0;
      font-size: 0.8rem;
      opacity: 0.8;
      font-family: 'Lato', sans-serif;
    }

    .spyglass-filters {
      background: #f5f5f5;
      padding: 16px 20px;
      border-left: 1px solid #ddd;
      border-right: 1px solid #ddd;
    }

    .spyglass-filters-row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 12px;
    }

    .spyglass-filters-row:last-child {
      margin-bottom: 0;
    }

    .spyglass-filter-group {
      display: flex;
      flex-direction: column;
      min-width: 140px;
      flex: 1;
    }

    .spyglass-filter-group label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #666;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-family: 'Lato', sans-serif;
    }

    .spyglass-filter-group select,
    .spyglass-filter-group input {
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 0.875rem;
      font-family: 'Lato', sans-serif;
      background: white;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .spyglass-filter-group select:focus,
    .spyglass-filter-group input:focus {
      outline: none;
      border-color: #E03103;
      box-shadow: 0 0 0 3px rgba(224, 49, 3, 0.1);
    }

    .spyglass-toggle-group {
      display: flex;
      border: 1px solid #ddd;
      border-radius: 6px;
      overflow: hidden;
      background: white;
    }

    .spyglass-toggle-btn {
      flex: 1;
      padding: 10px 16px;
      border: none;
      background: white;
      font-family: 'Lato', sans-serif;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s, color 0.2s;
    }

    .spyglass-toggle-btn:not(:last-child) {
      border-right: 1px solid #ddd;
    }

    .spyglass-toggle-btn.active {
      background: #E03103;
      color: white;
    }

    .spyglass-toggle-btn:hover:not(.active) {
      background: #eee;
    }

    .spyglass-btn-primary {
      background: #E03103;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-family: 'Lato', sans-serif;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
    }

    .spyglass-btn-primary:hover {
      background: #c42a03;
    }

    .spyglass-btn-primary:active {
      transform: scale(0.98);
    }

    .spyglass-btn-secondary {
      background: white;
      color: #E03103;
      border: 2px solid #E03103;
      padding: 10px 22px;
      border-radius: 6px;
      font-family: 'Lato', sans-serif;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, color 0.2s;
    }

    .spyglass-btn-secondary:hover {
      background: #E03103;
      color: white;
    }

    .spyglass-view-toggle {
      display: flex;
      gap: 8px;
      background: #f5f5f5;
      padding: 12px 20px;
      border-left: 1px solid #ddd;
      border-right: 1px solid #ddd;
      border-bottom: 1px solid #ddd;
    }

    .spyglass-view-btn {
      padding: 8px 16px;
      border: 1px solid #ddd;
      background: white;
      border-radius: 6px;
      font-family: 'Lato', sans-serif;
      font-size: 0.875rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }

    .spyglass-view-btn.active {
      background: #222222;
      color: white;
      border-color: #222222;
    }

    .spyglass-view-btn:hover:not(.active) {
      background: #eee;
    }

    .spyglass-view-btn svg {
      width: 16px;
      height: 16px;
    }

    .spyglass-results-info {
      padding: 12px 20px;
      background: white;
      border-left: 1px solid #ddd;
      border-right: 1px solid #ddd;
      font-size: 0.875rem;
      color: #666;
    }

    .spyglass-results-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
      padding: 20px;
      background: white;
      border: 1px solid #ddd;
      border-top: none;
      border-radius: 0 0 8px 8px;
      min-height: 300px;
    }

    .spyglass-property-card {
      border: 1px solid #ddd;
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      transition: box-shadow 0.2s, transform 0.2s;
      background: white;
    }

    .spyglass-property-card:hover {
      box-shadow: 0 4px 20px rgba(0,0,0,0.12);
      transform: translateY(-2px);
    }

    .spyglass-card-image {
      position: relative;
      padding-top: 66.67%;
      background: #ddd;
      overflow: hidden;
    }

    .spyglass-card-image img {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .spyglass-card-status {
      position: absolute;
      top: 12px;
      left: 12px;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .spyglass-status-active {
      background: #22c55e;
      color: white;
    }

    .spyglass-status-pending {
      background: #f59e0b;
      color: white;
    }

    .spyglass-status-under-contract {
      background: #3b82f6;
      color: white;
    }

    .spyglass-card-body {
      padding: 16px;
    }

    .spyglass-card-price {
      font-size: 1.25rem;
      font-weight: 700;
      color: #222222;
      margin-bottom: 8px;
      font-family: 'Playfair Display', serif;
    }

    .spyglass-card-address {
      font-size: 0.875rem;
      color: #666;
      margin-bottom: 12px;
      line-height: 1.4;
      font-family: 'Poppins', sans-serif;
    }

    .spyglass-card-features {
      display: flex;
      gap: 16px;
      font-size: 0.875rem;
      color: #444;
    }

    .spyglass-card-feature {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .spyglass-card-feature svg {
      width: 16px;
      height: 16px;
      color: #888;
    }

    .spyglass-map-container {
      height: 500px;
      background: #ddd;
      border: 1px solid #ddd;
      border-top: none;
      border-radius: 0 0 8px 8px;
      display: none;
    }

    .spyglass-map-container.active {
      display: block;
    }

    .spyglass-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: #666;
    }

    .spyglass-loading-spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #ddd;
      border-top-color: #E03103;
      border-radius: 50%;
      animation: spyglass-spin 0.8s linear infinite;
      margin-right: 12px;
    }

    @keyframes spyglass-spin {
      to { transform: rotate(360deg); }
    }

    .spyglass-no-results {
      grid-column: 1 / -1;
      text-align: center;
      padding: 60px 20px;
      color: #666;
    }

    .spyglass-pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      padding: 20px;
      background: white;
      border: 1px solid #ddd;
      border-top: none;
      border-radius: 0 0 8px 8px;
    }

    .spyglass-page-btn {
      padding: 8px 14px;
      border: 1px solid #ddd;
      background: white;
      border-radius: 6px;
      font-family: 'Lato', sans-serif;
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .spyglass-page-btn:hover:not(:disabled) {
      border-color: #E03103;
      color: #E03103;
    }

    .spyglass-page-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .spyglass-page-btn.active {
      background: #E03103;
      border-color: #E03103;
      color: white;
    }

    /* Detail Modal */
    .spyglass-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.7);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s, visibility 0.3s;
    }

    .spyglass-modal-overlay.active {
      opacity: 1;
      visibility: visible;
    }

    .spyglass-modal {
      background: white;
      border-radius: 12px;
      max-width: 900px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      transform: scale(0.95);
      transition: transform 0.3s;
    }

    .spyglass-modal-overlay.active .spyglass-modal {
      transform: scale(1);
    }

    .spyglass-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #ddd;
      background: #222222;
      color: white;
      border-radius: 12px 12px 0 0;
    }

    .spyglass-modal-close {
      background: none;
      border: none;
      color: white;
      font-size: 1.5rem;
      cursor: pointer;
      padding: 4px;
      line-height: 1;
    }

    .spyglass-modal-gallery {
      position: relative;
      background: #222222;
    }

    .spyglass-modal-main-image {
      width: 100%;
      height: 400px;
      object-fit: cover;
    }

    .spyglass-modal-thumbnails {
      display: flex;
      gap: 8px;
      padding: 12px;
      overflow-x: auto;
      background: #222222;
    }

    .spyglass-modal-thumb {
      width: 80px;
      height: 60px;
      object-fit: cover;
      border-radius: 4px;
      cursor: pointer;
      opacity: 0.6;
      transition: opacity 0.2s;
      flex-shrink: 0;
    }

    .spyglass-modal-thumb:hover,
    .spyglass-modal-thumb.active {
      opacity: 1;
    }

    .spyglass-modal-body {
      padding: 24px;
    }

    .spyglass-modal-price {
      font-size: 2rem;
      font-weight: 700;
      color: #222222;
      margin-bottom: 8px;
      font-family: 'Playfair Display', serif;
    }

    .spyglass-modal-address {
      font-size: 1.125rem;
      color: #666;
      margin-bottom: 20px;
      font-family: 'Poppins', sans-serif;
    }

    .spyglass-modal-features {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      padding: 20px;
      background: #f5f5f5;
      border-radius: 8px;
      margin-bottom: 24px;
    }

    .spyglass-modal-feature {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 80px;
    }

    .spyglass-modal-feature-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: #222222;
    }

    .spyglass-modal-feature-label {
      font-size: 0.75rem;
      color: #666;
      text-transform: uppercase;
    }

    .spyglass-modal-description {
      line-height: 1.7;
      color: #444;
    }

    .spyglass-modal-cta {
      margin-top: 24px;
      display: flex;
      gap: 12px;
    }

    /* Mobile Responsive */
    @media (max-width: 768px) {
      .spyglass-header {
        padding: 16px;
      }

      .spyglass-header h2 {
        font-size: 1.25rem;
      }

      .spyglass-filters {
        padding: 12px 16px;
      }

      .spyglass-filters-row {
        flex-direction: column;
        gap: 10px;
      }

      .spyglass-filter-group {
        min-width: 100%;
      }

      .spyglass-results-grid {
        grid-template-columns: 1fr;
        padding: 16px;
        gap: 16px;
      }

      .spyglass-map-container {
        height: 400px;
      }

      .spyglass-modal {
        max-height: 100vh;
        height: 100%;
        border-radius: 0;
      }

      .spyglass-modal-header {
        border-radius: 0;
      }

      .spyglass-modal-main-image {
        height: 250px;
      }

      .spyglass-modal-features {
        gap: 16px;
      }

      .spyglass-modal-feature {
        min-width: 60px;
      }

      .spyglass-modal-cta {
        flex-direction: column;
      }
    }

    /* Map Info Window */
    .spyglass-info-window {
      padding: 8px;
      min-width: 200px;
    }

    .spyglass-info-window img {
      width: 100%;
      height: 120px;
      object-fit: cover;
      border-radius: 4px;
      margin-bottom: 8px;
    }

    .spyglass-info-window-price {
      font-weight: 700;
      font-size: 1rem;
      margin-bottom: 4px;
      font-family: 'Playfair Display', serif;
    }

    .spyglass-info-window-address {
      font-size: 0.8rem;
      color: #666;
      margin-bottom: 8px;
      font-family: 'Poppins', sans-serif;
    }

    .spyglass-info-window-btn {
      background: #E03103;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 0.75rem;
      cursor: pointer;
      width: 100%;
    }

    /* Map Price Pins */
    .spyglass-price-pin {
      background: #E03103;
      color: white;
      font-weight: 700;
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 4px;
      white-space: nowrap;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      cursor: pointer;
      position: relative;
      font-family: 'Poppins', sans-serif;
      transition: transform 0.15s ease, background 0.15s ease;
      user-select: none;
    }

    .spyglass-price-pin::after {
      content: '';
      position: absolute;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 6px solid #E03103;
      transition: border-top-color 0.15s ease;
    }

    .spyglass-price-pin:hover {
      transform: scale(1.1);
      z-index: 1000;
    }

    .spyglass-price-pin.selected {
      background: #F5A623;
    }

    .spyglass-price-pin.selected::after {
      border-top-color: #F5A623;
    }

    /* Map Zoom Message */
    .spyglass-zoom-message {
      position: absolute;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid #ccc;
      border-radius: 20px;
      padding: 8px 16px;
      font-size: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: 'Poppins', sans-serif;
      pointer-events: none;
    }

    /* Map Cluster */
    .spyglass-cluster {
      background: #E03103;
      color: white;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      font-family: 'Poppins', sans-serif;
      transition: transform 0.15s ease;
      position: absolute;
    }

    .spyglass-cluster:hover {
      transform: scale(1.1);
    }

    /* Photo Count Badge */
    .spyglass-photo-count {
      position: absolute;
      bottom: 12px;
      left: 12px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 4px;
      z-index: 10;
    }

    .spyglass-photo-count svg {
      width: 16px;
      height: 16px;
    }

    /* Status Badge */
    .spyglass-status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      color: white;
      font-family: 'Poppins', sans-serif;
    }

    .spyglass-status-badge.active { background: #28a745; }
    .spyglass-status-badge.pending { background: #fd7e14; }
    .spyglass-status-badge.under-contract { background: #fd7e14; }
    .spyglass-status-badge.closed { background: #dc3545; }

    /* Price Per Sqft */
    .spyglass-price-per-sqft {
      font-size: 0.9rem;
      color: #666;
      font-family: 'Lato', sans-serif;
    }

    /* Property Info Sidebar */
    .spyglass-modal-info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
      margin-top: 16px;
      padding: 16px;
      background: #f9f9f9;
      border-radius: 8px;
      font-size: 0.875rem;
    }

    .spyglass-modal-info-label {
      color: #666;
      font-family: 'Lato', sans-serif;
    }

    .spyglass-modal-info-value {
      font-weight: 600;
      text-align: right;
      font-family: 'Poppins', sans-serif;
    }

    .spyglass-modal-info-value.green { color: #28a745; }
    .spyglass-modal-info-value.orange { color: #fd7e14; }
    .spyglass-modal-info-value.red { color: #dc3545; }

    .spyglass-mls-link {
      color: #E03103;
      text-decoration: none;
      cursor: pointer;
    }

    .spyglass-mls-link:hover {
      text-decoration: underline;
    }
  `;

  const ICONS = {
    bed: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>',
    bath: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.683 3 4 3.683 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><line x1="10" x2="8" y1="5" y2="7"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M7 19v2"/><path d="M17 19v2"/></svg>',
    sqft: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>',
    grid: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>',
    map: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/></svg>',
    close: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
  };

  class SpyglassPropertyWidget {
    constructor(containerId, options = {}) {
      this.containerId = containerId;
      this.container = document.getElementById(containerId);
      if (!this.container) {
        console.error('SpyglassPropertySearch: Container not found:', containerId);
        return;
      }

      this.options = {
        apiUrl: options.apiUrl || window.location.origin + '/api/widget',
        googleMapsKey: options.googleMapsKey || '',
        resultsPerPage: options.resultsPerPage || 12,
        fubTrackingEnabled: options.fubTrackingEnabled !== false,
        ...options
      };

      this.state = {
        properties: [],
        totalCount: 0,
        currentPage: 1,
        loading: false,
        view: 'grid',
        filters: {
          status: 'Active',
          type: 'sale',
          minPrice: '',
          maxPrice: '',
          beds: '',
          baths: '',
          propertyType: ''
        }
      };

      this.map = null;
      this.markers = [];
      this.infoWindow = null;
      
      // Bound event handlers for cleanup
      this._boundKeyHandler = this._handleKeyDown.bind(this);
      this._boundClickOutside = this._handleClickOutside.bind(this);

      this.init();
    }
    
    // FUB Widget Tracker integration
    trackEvent(eventType, eventData = {}) {
      if (!this.options.fubTrackingEnabled) return;
      
      try {
        if (typeof window.widgetTracker === 'function') {
          if (eventType === 'pageview') {
            window.widgetTracker('send', 'pageview');
          } else if (eventType === 'event') {
            window.widgetTracker('send', 'event', eventData);
          }
        }
      } catch (e) {
        console.warn('SpyglassPropertySearch: FUB tracking error', e);
      }
    }
    
    _handleKeyDown(event) {
      if (event.key === 'Escape') {
        this.closeModal();
      }
    }
    
    _handleClickOutside(event) {
      const modal = this.container.querySelector(`#${this.containerId}-modal`);
      if (modal && event.target === modal) {
        this.closeModal();
      }
    }

    init() {
      this.injectStyles();
      this.render();
      this.attachEventListeners();
      this.search();
    }

    injectStyles() {
      if (!document.getElementById('spyglass-widget-styles')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'spyglass-widget-styles';
        styleSheet.textContent = STYLES;
        document.head.appendChild(styleSheet);
      }
    }

    render() {
      const p = this.escapeHtml(this.containerId);
      const logoUrl = this.escapeHtml(this.options.logoUrl || (this.options.apiUrl ? `${this.options.apiUrl}/spyglass-logo-white.png` : '/spyglass-logo-white.png'));
      this.container.innerHTML = `
        <div class="spyglass-widget">
          <div class="spyglass-header">
            <img src="${logoUrl}" alt="Spyglass Realty" class="spyglass-header-logo">
            <div class="spyglass-header-content">
              <h2>Find Your Dream Home</h2>
              <p>Search properties in Austin and surrounding areas</p>
            </div>
          </div>

          <div class="spyglass-filters">
            <div class="spyglass-filters-row">
              <div class="spyglass-filter-group">
                <label>Status</label>
                <select id="${p}-status">
                  <option value="Active">Active</option>
                  <option value="Active Under Contract">Under Contract</option>
                  <option value="Pending">Pending</option>
                  <option value="">All Statuses</option>
                </select>
              </div>
              <div class="spyglass-filter-group">
                <label>Property Type</label>
                <select id="${p}-property-type">
                  <option value="">All Types</option>
                  <option value="Single Family">Single Family</option>
                  <option value="Condominium">Condo</option>
                  <option value="Townhouse">Townhouse</option>
                  <option value="Land">Land</option>
                </select>
              </div>
            </div>
            <div class="spyglass-filters-row">
              <div class="spyglass-filter-group">
                <label>Min Price</label>
                <select id="${p}-min-price">
                  <option value="">No Min</option>
                  <option value="100000">$100,000</option>
                  <option value="200000">$200,000</option>
                  <option value="300000">$300,000</option>
                  <option value="400000">$400,000</option>
                  <option value="500000">$500,000</option>
                  <option value="750000">$750,000</option>
                  <option value="1000000">$1,000,000</option>
                  <option value="1500000">$1,500,000</option>
                  <option value="2000000">$2,000,000</option>
                </select>
              </div>
              <div class="spyglass-filter-group">
                <label>Max Price</label>
                <select id="${p}-max-price">
                  <option value="">No Max</option>
                  <option value="200000">$200,000</option>
                  <option value="300000">$300,000</option>
                  <option value="400000">$400,000</option>
                  <option value="500000">$500,000</option>
                  <option value="750000">$750,000</option>
                  <option value="1000000">$1,000,000</option>
                  <option value="1500000">$1,500,000</option>
                  <option value="2000000">$2,000,000</option>
                  <option value="5000000">$5,000,000</option>
                </select>
              </div>
              <div class="spyglass-filter-group">
                <label>Beds</label>
                <select id="${p}-beds">
                  <option value="">Any</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5+</option>
                </select>
              </div>
              <div class="spyglass-filter-group">
                <label>Baths</label>
                <select id="${p}-baths">
                  <option value="">Any</option>
                  <option value="1">1+</option>
                  <option value="2">2+</option>
                  <option value="3">3+</option>
                  <option value="4">4+</option>
                </select>
              </div>
              <div class="spyglass-filter-group" style="justify-content: flex-end;">
                <button class="spyglass-btn-primary" id="${p}-search-btn">Search</button>
              </div>
            </div>
          </div>

          <div class="spyglass-view-toggle">
            <button class="spyglass-view-btn active" data-view="grid">
              ${ICONS.grid}
              Grid
            </button>
            <button class="spyglass-view-btn" data-view="map">
              ${ICONS.map}
              Map
            </button>
            <span id="${p}-results-count" style="margin-left: auto; font-size: 0.875rem; color: #666;"></span>
          </div>

          <div class="spyglass-results-grid" id="${p}-results"></div>
          <div class="spyglass-map-container" id="${p}-map"></div>
          <div class="spyglass-pagination" id="${p}-pagination"></div>
        </div>

        <div class="spyglass-modal-overlay" id="${p}-modal">
          <div class="spyglass-modal">
            <div class="spyglass-modal-header">
              <span>Property Details</span>
              <button class="spyglass-modal-close" id="${p}-modal-close">${ICONS.close}</button>
            </div>
            <div id="${p}-modal-content"></div>
          </div>
        </div>
      `;
    }

    attachEventListeners() {
      const prefix = this.containerId;
      
      // Search button
      this.container.querySelector(`#${prefix}-search-btn`).addEventListener('click', () => {
        this.state.currentPage = 1;
        this.search();
        this.trackEvent('event', { category: 'Search', action: 'submit', label: JSON.stringify(this.state.filters) });
      });

      // Filter changes
      const selects = [`${prefix}-status`, `${prefix}-property-type`, `${prefix}-min-price`, `${prefix}-max-price`, `${prefix}-beds`, `${prefix}-baths`];
      selects.forEach(id => {
        const el = this.container.querySelector(`#${id}`);
        if (el) {
          el.addEventListener('change', () => this.updateFiltersFromUI());
        }
      });

      // View toggle
      this.container.querySelectorAll('.spyglass-view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const view = e.currentTarget.dataset.view;
          this.setView(view);
          this.trackEvent('event', { category: 'View', action: 'toggle', label: view });
        });
      });

      // Modal close - instance scoped
      this.container.querySelector(`#${prefix}-modal-close`).addEventListener('click', () => this.closeModal());
      this.container.querySelector(`#${prefix}-modal`).addEventListener('click', this._boundClickOutside);

      // Keyboard close - scoped to this instance
      document.addEventListener('keydown', this._boundKeyHandler);
    }

    updateFiltersFromUI() {
      const prefix = this.containerId;
      this.state.filters.status = this.container.querySelector(`#${prefix}-status`).value;
      this.state.filters.propertyType = this.container.querySelector(`#${prefix}-property-type`).value;
      this.state.filters.minPrice = this.container.querySelector(`#${prefix}-min-price`).value;
      this.state.filters.maxPrice = this.container.querySelector(`#${prefix}-max-price`).value;
      this.state.filters.beds = this.container.querySelector(`#${prefix}-beds`).value;
      this.state.filters.baths = this.container.querySelector(`#${prefix}-baths`).value;
    }

    setView(view) {
      this.state.view = view;
      
      this.container.querySelectorAll('.spyglass-view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
      });

      const resultsGrid = this.container.querySelector('.spyglass-results-grid');
      const mapContainer = this.container.querySelector('.spyglass-map-container');
      const pagination = this.container.querySelector('.spyglass-pagination');

      if (view === 'grid') {
        resultsGrid.style.display = 'grid';
        mapContainer.classList.remove('active');
        pagination.style.display = 'flex';
      } else {
        resultsGrid.style.display = 'none';
        mapContainer.classList.add('active');
        pagination.style.display = 'none';
        this.initMap();
      }
    }

    async search() {
      this.state.loading = true;
      this.renderLoading();
      
      // Track search event
      this.trackEvent('event', { 
        category: 'Search', 
        action: 'execute', 
        label: `page_${this.state.currentPage}_status_${this.state.filters.status || 'all'}` 
      });

      const params = new URLSearchParams();
      params.append('page', this.state.currentPage);
      params.append('limit', this.options.resultsPerPage);

      if (this.state.filters.status) params.append('status', this.state.filters.status);
      params.append('type', 'sale');
      if (this.state.filters.minPrice) params.append('minPrice', this.state.filters.minPrice);
      if (this.state.filters.maxPrice) params.append('maxPrice', this.state.filters.maxPrice);
      if (this.state.filters.beds) params.append('beds', this.state.filters.beds);
      if (this.state.filters.baths) params.append('baths', this.state.filters.baths);
      if (this.state.filters.propertyType) params.append('propertyType', this.state.filters.propertyType);

      try {
        const response = await fetch(`${this.options.apiUrl}/search?${params.toString()}`);
        const data = await response.json();

        this.state.properties = data.properties || [];
        this.state.totalCount = data.total || 0;
        this.state.loading = false;

        this.renderResults();
        this.renderPagination();
        this.updateResultsCount();

        if (this.state.view === 'map') {
          this.updateMapMarkers();
        }
      } catch (error) {
        console.error('SpyglassPropertySearch: Search failed', error);
        this.state.loading = false;
        this.renderError();
      }
    }

    renderLoading() {
      const p = this.containerId;
      const resultsContainer = this.container.querySelector(`#${p}-results`);
      resultsContainer.innerHTML = `
        <div class="spyglass-loading">
          <div class="spyglass-loading-spinner"></div>
          <span>Searching properties...</span>
        </div>
      `;
    }

    renderError() {
      const p = this.containerId;
      const resultsContainer = this.container.querySelector(`#${p}-results`);
      resultsContainer.innerHTML = '';
      
      const noResultsDiv = document.createElement('div');
      noResultsDiv.className = 'spyglass-no-results';
      
      const messagePara = document.createElement('p');
      messagePara.textContent = 'Unable to load properties. Please try again.';
      noResultsDiv.appendChild(messagePara);
      
      const retryBtn = document.createElement('button');
      retryBtn.className = 'spyglass-btn-secondary';
      retryBtn.id = `${p}-retry-btn`;
      retryBtn.textContent = 'Retry';
      retryBtn.addEventListener('click', () => this.search());
      noResultsDiv.appendChild(retryBtn);
      
      resultsContainer.appendChild(noResultsDiv);
    }

    renderResults() {
      const p = this.containerId;
      const resultsContainer = this.container.querySelector(`#${p}-results`);

      if (this.state.properties.length === 0) {
        resultsContainer.innerHTML = `
          <div class="spyglass-no-results">
            <p>No properties found matching your criteria.</p>
            <p style="font-size: 0.875rem; margin-top: 8px;">Try adjusting your filters.</p>
          </div>
        `;
        return;
      }

      resultsContainer.innerHTML = this.state.properties.map(property => this.renderPropertyCard(property)).join('');

      // Add click handlers
      resultsContainer.querySelectorAll('.spyglass-property-card').forEach(card => {
        card.addEventListener('click', () => {
          const mlsId = card.dataset.mlsId;
          const property = this.state.properties.find(p => p.listingId === mlsId);
          if (property) this.openPropertyDetail(property);
        });
      });
    }

    renderPropertyCard(property) {
      const imageUrl = property.primaryPhoto || 'https://placehold.co/400x300/e0e0e0/666?text=No+Photo';
      const status = property.standardStatus || 'Active';
      const statusClass = status === 'Active' ? 'active' : 
                         status === 'Pending' ? 'pending' : 'under-contract';

      return `
        <div class="spyglass-property-card" data-mls-id="${this.escapeHtml(String(property.listingId))}">
          <div class="spyglass-card-image">
            <img src="${this.escapeHtml(imageUrl)}" alt="${this.escapeHtml(property.streetAddress || 'Property')}" loading="lazy" onerror="this.src='https://placehold.co/400x300/e0e0e0/666?text=No+Photo'">
            <span class="spyglass-card-status spyglass-status-${statusClass}">${this.escapeHtml(status)}</span>
          </div>
          <div class="spyglass-card-body">
            <div class="spyglass-card-price">$${this.formatNumber(property.listPrice)}</div>
            <div class="spyglass-card-address">
              ${this.escapeHtml(property.streetAddress || '')}${property.city ? ', ' + this.escapeHtml(property.city) : ''}
            </div>
            <div class="spyglass-card-features">
              ${property.bedroomsTotal ? `<span class="spyglass-card-feature">${ICONS.bed} ${this.escapeHtml(String(property.bedroomsTotal))} beds</span>` : ''}
              ${property.bathroomsTotalInteger ? `<span class="spyglass-card-feature">${ICONS.bath} ${this.escapeHtml(String(property.bathroomsTotalInteger))} baths</span>` : ''}
              ${property.livingArea ? `<span class="spyglass-card-feature">${ICONS.sqft} ${this.formatNumber(property.livingArea)} sqft</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }

    renderPagination() {
      const p = this.containerId;
      const paginationContainer = this.container.querySelector(`#${p}-pagination`);
      const totalPages = Math.ceil(this.state.totalCount / this.options.resultsPerPage);

      paginationContainer.replaceChildren();

      if (totalPages <= 1) {
        return;
      }

      const createPageButton = (pageNum, label, isDisabled, isActive) => {
        const btn = document.createElement('button');
        btn.className = 'spyglass-page-btn' + (isActive ? ' active' : '');
        btn.disabled = isDisabled;
        btn.dataset.page = pageNum;
        btn.textContent = label;
        return btn;
      };

      paginationContainer.appendChild(
        createPageButton(this.state.currentPage - 1, 'Prev', this.state.currentPage === 1, false)
      );

      const maxPages = 5;
      let startPage = Math.max(1, this.state.currentPage - Math.floor(maxPages / 2));
      let endPage = Math.min(totalPages, startPage + maxPages - 1);

      if (endPage - startPage < maxPages - 1) {
        startPage = Math.max(1, endPage - maxPages + 1);
      }

      for (let i = startPage; i <= endPage; i++) {
        paginationContainer.appendChild(
          createPageButton(i, String(i), false, i === this.state.currentPage)
        );
      }

      paginationContainer.appendChild(
        createPageButton(this.state.currentPage + 1, 'Next', this.state.currentPage === totalPages, false)
      );

      // Add click handlers
      paginationContainer.querySelectorAll('.spyglass-page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (!btn.disabled) {
            this.state.currentPage = parseInt(btn.dataset.page);
            this.search();
            this.trackEvent('event', { category: 'Pagination', action: 'click', label: `page_${btn.dataset.page}` });
            this.container.scrollIntoView({ behavior: 'smooth' });
          }
        });
      });
    }

    updateResultsCount() {
      const p = this.containerId;
      const countEl = this.container.querySelector(`#${p}-results-count`);
      countEl.textContent = `${this.formatNumber(this.state.totalCount)} properties found`;
    }

    async initMap() {
      const p = this.containerId;
      const mapContainer = this.container.querySelector(`#${p}-map`);
      
      if (!window.google || !window.google.maps) {
        if (!this.options.googleMapsKey) {
          mapContainer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;">Map requires Google Maps API key</div>';
          return;
        }
        
        // Load Google Maps
        await this.loadGoogleMaps();
      }

      if (!this.map) {
        this.map = new google.maps.Map(mapContainer, {
          center: { lat: 30.2672, lng: -97.7431 },
          zoom: 11,
          styles: [
            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', stylers: [{ visibility: 'off' }] }
          ]
        });

        this.infoWindow = new google.maps.InfoWindow();

        // Add zoom message overlay
        this.zoomMessage = document.createElement('div');
        this.zoomMessage.className = 'spyglass-zoom-message';
        this.zoomMessage.innerHTML = '\u2295 Zoom in to see more listings';
        this.zoomMessage.style.display = 'none';
        mapContainer.style.position = 'relative';
        mapContainer.appendChild(this.zoomMessage);

        // Listen for zoom changes - only update markers and message, not bounds
        this.map.addListener('zoom_changed', () => {
          this.updateZoomMessage();
          this.updateMapMarkers(false); // false = don't fit bounds
        });

        // Wait for map to be idle before initial clustering (ensures projection is available)
        google.maps.event.addListenerOnce(this.map, 'idle', () => {
          this.updateMapMarkers(true); // fit bounds on initial load
        });
      } else {
        // Map already exists, update markers directly
        this.updateMapMarkers(true);
      }
    }

    updateZoomMessage() {
      if (!this.zoomMessage || !this.map) return;
      const zoom = this.map.getZoom();
      this.zoomMessage.style.display = zoom < 10 ? 'flex' : 'none';
    }

    loadGoogleMaps() {
      return new Promise((resolve, reject) => {
        if (window.google && window.google.maps) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${this.options.googleMapsKey}`;
        script.async = true;
        script.defer = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    updateMapMarkers(fitBounds = true) {
      if (!this.map) return;

      // Clear existing markers
      if (this.markers) {
        this.markers.forEach(marker => {
          if (marker.overlay && marker.overlay.setMap) {
            marker.overlay.setMap(null);
          }
        });
      }
      this.markers = [];
      
      // Clear existing clusters
      if (this.clusters) {
        this.clusters.forEach(cluster => {
          if (cluster && cluster.setMap) cluster.setMap(null);
        });
      }
      this.clusters = [];

      // Clear selected marker reference
      this.selectedMarker = null;

      // Update zoom message
      this.updateZoomMessage();

      const bounds = new google.maps.LatLngBounds();
      const properties = this.state.properties.slice(0, 500); // Limit to 500 pins
      const validProperties = properties.filter(p => p.latitude && p.longitude);

      // Convert properties to points
      const points = validProperties.map(property => {
        const position = { lat: parseFloat(property.latitude), lng: parseFloat(property.longitude) };
        bounds.extend(position);
        return { property, position };
      });

      // Cluster properties based on zoom level
      const zoom = this.map.getZoom() || 11;
      const clustered = this.clusterProperties(points, zoom);

      clustered.forEach(item => {
        if (item.isCluster) {
          // Create cluster overlay
          const overlay = this.createClusterOverlay(item.position, item.properties);
          overlay.setMap(this.map);
          this.clusters.push(overlay);
        } else {
          // Create single price pin
          const priceLabel = this.formatPinPrice(item.property.listPrice);
          const overlay = this.createPricePinOverlay(item.position, priceLabel, item.property);
          overlay.setMap(this.map);
          this.markers.push({ overlay, property: item.property });
        }
      });

      // Only fit bounds on initial load or when data changes, not on zoom changes
      if (fitBounds && validProperties.length > 0) {
        this.map.fitBounds(bounds);
      }
    }

    clusterProperties(points, zoom) {
      if (points.length === 0) return [];

      // At high zoom levels (close up), don't cluster - show all individual pins
      if (zoom >= 15) {
        return points.map(p => ({ ...p, isCluster: false }));
      }

      // Distance threshold in degrees - adjusted by zoom level
      // At zoom 10: ~0.02 degrees (~2km)
      // At zoom 12: ~0.005 degrees (~500m)
      // At zoom 14: ~0.001 degrees (~100m)
      const baseRadius = 0.02;
      const radiusMultiplier = Math.pow(2, 12 - zoom);
      const clusterRadius = baseRadius * radiusMultiplier;

      const clustered = [];
      const used = new Set();

      for (let i = 0; i < points.length; i++) {
        if (used.has(i)) continue;

        const point = points[i];
        const nearby = [point];
        used.add(i);

        for (let j = i + 1; j < points.length; j++) {
          if (used.has(j)) continue;

          const other = points[j];
          const dLat = point.position.lat - other.position.lat;
          const dLng = point.position.lng - other.position.lng;
          const distance = Math.sqrt(dLat * dLat + dLng * dLng);

          if (distance < clusterRadius) {
            nearby.push(other);
            used.add(j);
          }
        }

        if (nearby.length > 1) {
          // Calculate cluster center
          const avgLat = nearby.reduce((sum, p) => sum + p.position.lat, 0) / nearby.length;
          const avgLng = nearby.reduce((sum, p) => sum + p.position.lng, 0) / nearby.length;
          clustered.push({
            isCluster: true,
            position: { lat: avgLat, lng: avgLng },
            properties: nearby.map(p => p.property)
          });
        } else {
          clustered.push({
            isCluster: false,
            position: point.position,
            property: point.property
          });
        }
      }

      return clustered;
    }

    createClusterOverlay(position, properties) {
      const widget = this;

      class ClusterOverlay extends google.maps.OverlayView {
        constructor(position, properties) {
          super();
          this.position = position;
          this.properties = properties;
          this.div = null;
        }

        onAdd() {
          this.div = document.createElement('div');
          this.div.className = 'spyglass-cluster';
          this.div.textContent = String(this.properties.length);

          this.div.addEventListener('click', (e) => {
            e.stopPropagation();
            // Zoom in to show individual properties
            widget.map.setCenter(new google.maps.LatLng(this.position.lat, this.position.lng));
            widget.map.setZoom(widget.map.getZoom() + 2);
          });

          const panes = this.getPanes();
          panes.overlayMouseTarget.appendChild(this.div);
        }

        draw() {
          const overlayProjection = this.getProjection();
          const pos = overlayProjection.fromLatLngToDivPixel(new google.maps.LatLng(this.position.lat, this.position.lng));

          if (this.div) {
            this.div.style.left = (pos.x - 18) + 'px';
            this.div.style.top = (pos.y - 18) + 'px';
          }
        }

        onRemove() {
          if (this.div) {
            this.div.parentNode.removeChild(this.div);
            this.div = null;
          }
        }

        setMap(map) {
          super.setMap(map);
        }
      }

      return new ClusterOverlay(position, properties);
    }

    createPricePinOverlay(position, priceLabel, property) {
      const widget = this;

      class PricePinOverlay extends google.maps.OverlayView {
        constructor(position, priceLabel, property) {
          super();
          this.position = position;
          this.priceLabel = priceLabel;
          this.property = property;
          this.div = null;
        }

        onAdd() {
          this.div = document.createElement('div');
          this.div.className = 'spyglass-price-pin';
          this.div.textContent = this.priceLabel;
          this.div.style.position = 'absolute';

          this.div.addEventListener('click', (e) => {
            e.stopPropagation();

            // Deselect previous marker
            if (widget.selectedMarker && widget.selectedMarker !== this.div) {
              widget.selectedMarker.classList.remove('selected');
              widget.selectedMarker.textContent = widget.selectedMarker.dataset.price;
            }

            // Select this marker
            this.div.classList.add('selected');
            this.div.dataset.price = this.priceLabel;
            this.div.textContent = '\u2713 ' + this.priceLabel;
            widget.selectedMarker = this.div;

            // Show info window
            const propJson = JSON.stringify(this.property).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const infoContent = `
              <div class="spyglass-info-window">
                <img src="${widget.escapeHtml(this.property.primaryPhoto) || 'https://placehold.co/200x120/e0e0e0/666?text=No+Photo'}" alt="${widget.escapeHtml(this.property.streetAddress)}" onerror="this.src='https://placehold.co/200x120/e0e0e0/666?text=No+Photo'">
                <div class="spyglass-info-window-price">$${widget.formatNumber(this.property.listPrice)}</div>
                <div class="spyglass-info-window-address">${widget.escapeHtml(this.property.streetAddress) || ''}</div>
                <button class="spyglass-info-window-btn" onclick="document.getElementById('${widget.escapeHtml(widget.containerId)}').__spyglassWidget.openPropertyDetail(${propJson})">View Details</button>
              </div>
            `;
            widget.infoWindow.setContent(infoContent);
            widget.infoWindow.setPosition(this.position);
            widget.infoWindow.open(widget.map);
          });

          const panes = this.getPanes();
          panes.overlayMouseTarget.appendChild(this.div);
        }

        draw() {
          const overlayProjection = this.getProjection();
          const pos = overlayProjection.fromLatLngToDivPixel(new google.maps.LatLng(this.position.lat, this.position.lng));

          if (this.div) {
            // Center the pin horizontally and position the pointer at the location
            this.div.style.left = pos.x + 'px';
            this.div.style.top = pos.y + 'px';
            this.div.style.transform = 'translate(-50%, -100%) translateY(-6px)';
          }
        }

        onRemove() {
          if (this.div) {
            this.div.parentNode.removeChild(this.div);
            this.div = null;
          }
        }

        setMap(map) {
          super.setMap(map);
        }
      }

      return new PricePinOverlay(position, priceLabel, property);
    }

    openPropertyDetail(property) {
      // Track pageview with FUB Widget Tracker
      this.trackEvent('pageview');
      this.trackEvent('event', { category: 'Property', action: 'view', label: property.listingId });

      const p = this.containerId;
      const modal = this.container.querySelector(`#${p}-modal`);
      const content = this.container.querySelector(`#${p}-modal-content`);

      const photos = property.photos || [];
      const mainPhoto = property.primaryPhoto || (photos[0]?.mediaUrl) || 'https://placehold.co/900x400/e0e0e0/666?text=No+Photo';
      const photoCount = photos.length || (property.primaryPhoto ? 1 : 0);

      // Calculate derived values
      const daysOnMarket = this.calculateDaysOnMarket(property);
      const pricePerSqft = this.calculatePricePerSqft(property);
      const status = property.standardStatus || 'Active';
      const statusClass = this.getStatusBadgeClass(status);
      const isClosed = statusClass === 'closed';

      // Date fields
      const listDate = property.listDate || property.listingDate || property.onMarketDate;
      const soldDate = property.soldDate || property.closeDate;
      const lastUpdated = property.lastModified || property.updatedAt || property.modificationTimestamp;

      // Calculate sold price percentage if closed
      let soldPricePercent = null;
      let soldPriceClass = '';
      if (isClosed && property.closePrice && property.listPrice) {
        soldPricePercent = ((property.closePrice / property.listPrice) * 100).toFixed(1);
        if (soldPricePercent >= 100) soldPriceClass = 'green';
        else if (soldPricePercent >= 95) soldPriceClass = 'orange';
        else soldPriceClass = 'red';
      }

      content.innerHTML = `
        <div class="spyglass-modal-gallery" style="position: relative;">
          <img class="spyglass-modal-main-image" id="${p}-main-image" src="${this.escapeHtml(mainPhoto)}" alt="${this.escapeHtml(property.streetAddress)}" onerror="this.src='https://placehold.co/900x400/e0e0e0/666?text=No+Photo'">
          ${photoCount > 0 ? `
            <div class="spyglass-photo-count">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
              <span>${photoCount}</span>
            </div>
          ` : ''}
          ${photos.length > 1 ? `
            <div class="spyglass-modal-thumbnails">
              ${photos.slice(0, 10).map((photo, i) => `
                <img class="spyglass-modal-thumb ${i === 0 ? 'active' : ''}" src="${this.escapeHtml(photo.mediaUrl)}" alt="Photo ${i + 1}" data-url="${this.escapeHtml(photo.mediaUrl)}" onerror="this.style.display='none'">
              `).join('')}
            </div>
          ` : ''}
        </div>
        <div class="spyglass-modal-body">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
            <span class="spyglass-status-badge ${statusClass}">${this.escapeHtml(status)}${daysOnMarket !== null ? ` &bull; ${daysOnMarket} DAYS` : ''}</span>
            ${pricePerSqft ? `<span class="spyglass-price-per-sqft">$${this.formatNumber(pricePerSqft)}/sqft</span>` : ''}
          </div>
          <div class="spyglass-modal-price">$${this.formatNumber(property.listPrice)}</div>
          <div class="spyglass-modal-address">
            ${this.escapeHtml(property.streetAddress) || ''}${property.city ? ', ' + this.escapeHtml(property.city) : ''}${property.stateOrProvince ? ', ' + this.escapeHtml(property.stateOrProvince) : ''} ${this.escapeHtml(property.postalCode) || ''}
          </div>
          <div class="spyglass-modal-features">
            ${property.bedroomsTotal ? `
              <div class="spyglass-modal-feature">
                <div class="spyglass-modal-feature-value">${this.escapeHtml(String(property.bedroomsTotal))}</div>
                <div class="spyglass-modal-feature-label">Bedrooms</div>
              </div>
            ` : ''}
            ${property.bathroomsTotalInteger ? `
              <div class="spyglass-modal-feature">
                <div class="spyglass-modal-feature-value">${this.escapeHtml(String(property.bathroomsTotalInteger))}</div>
                <div class="spyglass-modal-feature-label">Bathrooms</div>
              </div>
            ` : ''}
            ${property.livingArea ? `
              <div class="spyglass-modal-feature">
                <div class="spyglass-modal-feature-value">${this.formatNumber(property.livingArea)}</div>
                <div class="spyglass-modal-feature-label">Sq Ft</div>
              </div>
            ` : ''}
            ${property.yearBuilt ? `
              <div class="spyglass-modal-feature">
                <div class="spyglass-modal-feature-value">${this.escapeHtml(String(property.yearBuilt))}</div>
                <div class="spyglass-modal-feature-label">Year Built</div>
              </div>
            ` : ''}
            ${property.lotSizeArea ? `
              <div class="spyglass-modal-feature">
                <div class="spyglass-modal-feature-value">${this.formatNumber(property.lotSizeArea)}</div>
                <div class="spyglass-modal-feature-label">Lot Sq Ft</div>
              </div>
            ` : ''}
          </div>

          <div class="spyglass-modal-info-grid">
            ${listDate ? `
              <span class="spyglass-modal-info-label">Listed:</span>
              <span class="spyglass-modal-info-value">${this.formatDate(listDate)}</span>
            ` : ''}
            ${isClosed && soldDate ? `
              <span class="spyglass-modal-info-label">Sold:</span>
              <span class="spyglass-modal-info-value">${this.formatDate(soldDate)}</span>
            ` : ''}
            ${property.originalListPrice ? `
              <span class="spyglass-modal-info-label">Original Price:</span>
              <span class="spyglass-modal-info-value">$${this.formatNumber(property.originalListPrice)}</span>
            ` : ''}
            <span class="spyglass-modal-info-label">List Price:</span>
            <span class="spyglass-modal-info-value">$${this.formatNumber(property.listPrice)}</span>
            ${isClosed && property.closePrice ? `
              <span class="spyglass-modal-info-label">Sold Price:</span>
              <span class="spyglass-modal-info-value ${soldPriceClass}">${soldPricePercent}% $${this.formatNumber(property.closePrice)}</span>
            ` : ''}
            ${property.listingId ? `
              <span class="spyglass-modal-info-label">MLS #</span>
              <span class="spyglass-modal-info-value"><span class="spyglass-mls-link">${this.escapeHtml(String(property.listingId))}</span></span>
            ` : ''}
            ${lastUpdated ? `
              <span class="spyglass-modal-info-label">Updated:</span>
              <span class="spyglass-modal-info-value">${this.formatDateTime(lastUpdated)}</span>
            ` : ''}
          </div>

          ${property.publicRemarks ? `
            <div class="spyglass-modal-description">
              <h4 style="margin: 0 0 12px 0; font-size: 1rem;">Description</h4>
              <p style="margin: 0;">${this.escapeHtml(property.publicRemarks)}</p>
            </div>
          ` : ''}
          <div class="spyglass-modal-cta">
            <button class="spyglass-btn-primary" onclick="window.open('mailto:info@spyglassrealty.com?subject=Inquiry about ${encodeURIComponent(property.streetAddress || 'Property')}', '_blank')">Contact Agent</button>
          </div>
        </div>
      `;

      // Thumbnail click handlers
      content.querySelectorAll('.spyglass-modal-thumb').forEach(thumb => {
        thumb.addEventListener('click', (e) => {
          const mainImage = content.querySelector(`#${p}-main-image`);
          mainImage.src = e.target.dataset.url;
          content.querySelectorAll('.spyglass-modal-thumb').forEach(t => t.classList.remove('active'));
          e.target.classList.add('active');
        });
      });

      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    closeModal() {
      const p = this.containerId;
      const modal = this.container.querySelector(`#${p}-modal`);
      if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    }

    formatNumber(num) {
      if (!num) return '0';
      return parseInt(num).toLocaleString();
    }

    formatPinPrice(price) {
      if (!price) return '$0';
      if (price >= 1000000) {
        return '$' + (price / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
      } else {
        return '$' + Math.round(price / 1000) + 'K';
      }
    }

    formatDate(dateStr) {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      return `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(-2)}`;
    }

    formatDateTime(dateStr) {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      const displayMinutes = String(minutes).padStart(2, '0');
      return `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(-2)} ${displayHours}:${displayMinutes} ${ampm}`;
    }

    calculateDaysOnMarket(property) {
      const listDate = property.listDate || property.listingDate || property.onMarketDate;
      if (!listDate) return null;
      
      const start = new Date(listDate);
      if (isNaN(start.getTime())) return null;

      let end;
      if ((property.standardStatus || '').toLowerCase() === 'closed' && property.soldDate) {
        end = new Date(property.soldDate);
      } else {
        end = new Date();
      }

      const diffTime = Math.abs(end - start);
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    calculatePricePerSqft(property) {
      if (!property.listPrice || !property.livingArea) return null;
      return Math.round(property.listPrice / property.livingArea);
    }

    getStatusBadgeClass(status) {
      const s = (status || '').toLowerCase();
      if (s === 'active') return 'active';
      if (s === 'pending') return 'pending';
      if (s.includes('under contract') || s.includes('active under contract')) return 'under-contract';
      if (s === 'closed' || s === 'sold') return 'closed';
      return 'active';
    }

    escapeHtml(str) {
      if (!str) return '';
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    destroy() {
      // Remove keyboard listener
      document.removeEventListener('keydown', this._boundKeyHandler);
      
      // Clear map resources
      if (this.markers) {
        this.markers.forEach(marker => {
          if (marker.setMap) marker.setMap(null);
          if (marker.overlay) marker.overlay.setMap(null);
        });
        this.markers = [];
      }
      if (this.infoWindow) {
        this.infoWindow.close();
      }
      this.map = null;
      this.selectedMarker = null;
      
      // Clear container
      if (this.container) {
        this.container.innerHTML = '';
      }
    }
  }

  // Global init function
  window.SpyglassPropertySearch = {
    init: function(containerId, options) {
      const widget = new SpyglassPropertyWidget(containerId, options);
      // Store reference for map info window callbacks
      const container = document.getElementById(containerId);
      if (container) {
        container.__spyglassWidget = widget;
      }
      return widget;
    },
    destroy: function(containerId) {
      const container = document.getElementById(containerId);
      if (container && container.__spyglassWidget) {
        container.__spyglassWidget.destroy();
        delete container.__spyglassWidget;
      }
    }
  };
})();
