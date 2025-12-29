(function() {
  'use strict';

  const WIDGET_VERSION = '1.0.0';
  const DEFAULT_OPTIONS = {
    apiUrl: '',
    wpUserId: '',
    loginUrl: '/login',
    resultsPerPage: 12,
    showPropertySearch: true,
  };

  const STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=Lato:wght@400;700&display=swap');

    .spyglass-favorites-widget {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #333;
      line-height: 1.5;
    }
    .spyglass-favorites-widget * {
      box-sizing: border-box;
    }
    .spyglass-favorites-header {
      background: #000000;
      color: white;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-radius: 8px 8px 0 0;
      gap: 16px;
    }
    .spyglass-favorites-header-logo {
      height: 40px;
      width: auto;
    }
    .spyglass-favorites-header-content {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .spyglass-favorites-header h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      font-family: 'Playfair Display', serif;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .spyglass-favorites-header .heart-icon {
      color: #E03103;
    }
    .spyglass-favorites-tabs {
      display: flex;
      gap: 4px;
    }
    .spyglass-favorites-tab {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.3);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-family: 'Lato', sans-serif;
      transition: all 0.2s;
    }
    .spyglass-favorites-tab:hover {
      background: rgba(255,255,255,0.1);
    }
    .spyglass-favorites-tab.active {
      background: #E03103;
      border-color: #E03103;
    }
    .spyglass-favorites-content {
      background: #fff;
      border: 1px solid #e5e5e5;
      border-top: none;
      border-radius: 0 0 8px 8px;
      min-height: 400px;
    }
    .spyglass-favorites-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: #666;
    }
    .spyglass-favorites-loading .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #E03103;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-right: 12px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .spyglass-favorites-empty {
      text-align: center;
      padding: 60px 20px;
      color: #666;
    }
    .spyglass-favorites-empty .icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }
    .spyglass-favorites-empty h3 {
      margin: 0 0 8px 0;
      color: #222222;
      font-family: 'Playfair Display', serif;
    }
    .spyglass-favorites-empty p {
      margin: 0;
      font-size: 14px;
      font-family: 'Lato', sans-serif;
    }
    .spyglass-favorites-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
      padding: 20px;
    }
    .spyglass-property-card {
      background: #fff;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      overflow: hidden;
      transition: box-shadow 0.2s;
    }
    .spyglass-property-card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .spyglass-property-image {
      position: relative;
      height: 180px;
      background: #f5f5f5;
      overflow: hidden;
    }
    .spyglass-property-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .spyglass-property-image .no-image {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #999;
      font-size: 14px;
    }
    .spyglass-favorite-btn {
      position: absolute;
      top: 10px;
      right: 10px;
      width: 36px;
      height: 36px;
      background: white;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      transition: transform 0.2s;
    }
    .spyglass-favorite-btn:hover {
      transform: scale(1.1);
    }
    .spyglass-favorite-btn svg {
      width: 20px;
      height: 20px;
    }
    .spyglass-favorite-btn .heart-outline {
      stroke: #E03103;
      fill: none;
    }
    .spyglass-favorite-btn .heart-filled {
      fill: #E03103;
      stroke: #E03103;
    }
    .spyglass-property-status {
      position: absolute;
      top: 10px;
      left: 10px;
      background: #E03103;
      color: white;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    .spyglass-property-status.pending {
      background: #fbbf24;
      color: #222222;
    }
    .spyglass-property-status.sold {
      background: #dc2626;
    }
    .spyglass-property-info {
      padding: 16px;
    }
    .spyglass-property-price {
      font-size: 22px;
      font-weight: 700;
      color: #222222;
      margin: 0 0 8px 0;
      font-family: 'Playfair Display', serif;
    }
    .spyglass-property-address {
      font-size: 14px;
      color: #333;
      margin: 0 0 4px 0;
      font-family: 'Poppins', sans-serif;
    }
    .spyglass-property-location {
      font-size: 13px;
      color: #666;
      margin: 0 0 12px 0;
      font-family: 'Poppins', sans-serif;
    }
    .spyglass-property-details {
      display: flex;
      gap: 16px;
      font-size: 13px;
      color: #666;
      font-family: 'Poppins', sans-serif;
    }
    .spyglass-property-details span {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .spyglass-login-prompt {
      text-align: center;
      padding: 60px 20px;
    }
    .spyglass-login-prompt .icon {
      font-size: 48px;
      margin-bottom: 16px;
      color: #E03103;
    }
    .spyglass-login-prompt h3 {
      margin: 0 0 8px 0;
      color: #333;
      font-family: 'Playfair Display', serif;
    }
    .spyglass-login-prompt p {
      margin: 0 0 20px 0;
      color: #666;
      font-size: 14px;
      font-family: 'Poppins', sans-serif;
    }
    .spyglass-login-btn {
      background: #E03103;
      color: white;
      border: none;
      padding: 12px 32px;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
      font-family: 'Lato', sans-serif;
    }
    .spyglass-login-btn:hover {
      background: #c42a03;
    }
    .spyglass-error {
      text-align: center;
      padding: 40px 20px;
      color: #dc2626;
    }
    .spyglass-error button {
      margin-top: 16px;
      background: #E03103;
      color: white;
      border: none;
      padding: 10px 24px;
      border-radius: 6px;
      cursor: pointer;
      font-family: 'Lato', sans-serif;
    }
    .spyglass-pagination {
      display: flex;
      justify-content: center;
      gap: 8px;
      padding: 20px;
      border-top: 1px solid #e5e5e5;
    }
    .spyglass-pagination button {
      background: white;
      border: 1px solid #e5e5e5;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-family: 'Lato', sans-serif;
    }
    .spyglass-pagination button:hover:not(:disabled) {
      background: #f5f5f5;
    }
    .spyglass-pagination button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .spyglass-pagination button.active {
      background: #E03103;
      color: white;
      border-color: #E03103;
    }
  `;

  function injectStyles() {
    if (document.getElementById('spyglass-favorites-styles')) return;
    const style = document.createElement('style');
    style.id = 'spyglass-favorites-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  class SpyglassFavoritesWidget {
    constructor(containerId, options = {}) {
      this.containerId = containerId;
      this.container = document.getElementById(containerId);
      this.options = { ...DEFAULT_OPTIONS, ...options };
      this.state = {
        loading: false,
        error: null,
        favorites: [],
        properties: [],
        currentView: 'favorites',
        currentPage: 1,
        totalProperties: 0,
        favoriteIds: new Set(),
      };
      this.keyHandler = null;
    }

    init() {
      if (!this.container) {
        console.error(`[SpyglassFavorites] Container #${this.containerId} not found`);
        return;
      }

      injectStyles();
      this.container.classList.add('spyglass-favorites-widget');
      this.render();
      
      if (this.options.wpUserId) {
        this.loadFavorites();
      }
    }

    trackEvent(action, data = {}) {
      if (typeof window.widgetTracker === 'function') {
        try {
          window.widgetTracker('send', 'pageview');
        } catch (e) {
          console.warn('[SpyglassFavorites] Tracking error:', e);
        }
      }
    }

    async loadFavorites() {
      if (!this.options.wpUserId) {
        this.render();
        return;
      }

      this.state.loading = true;
      this.state.error = null;
      this.renderContent();

      try {
        const url = `${this.options.apiUrl}/api/wordpress/favorites/${encodeURIComponent(this.options.wpUserId)}`;
        const response = await fetch(url, { credentials: 'include' });
        
        if (!response.ok) {
          if (response.status === 401) {
            this.state.currentView = 'login';
            this.state.loading = false;
            this.renderContent();
            return;
          }
          throw new Error('Failed to load favorites');
        }

        const data = await response.json();
        
        if (data.success) {
          this.state.favorites = data.favorites || [];
          this.state.favoriteIds = new Set(this.state.favorites.map(f => f.propertyId));
        } else {
          throw new Error(data.error || 'Failed to load favorites');
        }
      } catch (error) {
        console.error('[SpyglassFavorites] Load error:', error);
        this.state.error = error.message;
      } finally {
        this.state.loading = false;
        this.renderContent();
      }
    }

    async toggleFavorite(propertyId) {
      if (!this.options.wpUserId) {
        this.showLoginPrompt();
        return;
      }

      const isFavorited = this.state.favoriteIds.has(propertyId);
      const url = `${this.options.apiUrl}/api/wordpress/favorites`;

      try {
        const response = await fetch(url, {
          method: isFavorited ? 'DELETE' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            wpUserId: this.options.wpUserId,
            propertyId: propertyId,
          }),
        });

        if (!response.ok) {
          if (response.status === 401) {
            this.showLoginPrompt();
            return;
          }
          throw new Error('Failed to update favorite');
        }

        const data = await response.json();

        if (data.success) {
          if (isFavorited) {
            this.state.favoriteIds.delete(propertyId);
            this.state.favorites = this.state.favorites.filter(f => f.propertyId !== propertyId);
          } else {
            this.state.favoriteIds.add(propertyId);
            // Find the property in state.properties and add to favorites
            const property = this.state.properties.find(p => p.listingId === propertyId);
            if (property) {
              this.state.favorites.push({
                propertyId: propertyId,
                property: property,
              });
            }
            this.trackEvent('favorite_add', { propertyId });
          }
          this.render(); // Re-render to update tab count
        }
      } catch (error) {
        console.error('[SpyglassFavorites] Toggle error:', error);
      }
    }

    async loadProperties(page = 1) {
      if (!this.options.showPropertySearch) return;

      this.state.loading = true;
      this.state.currentPage = page;
      this.renderContent();

      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: this.options.resultsPerPage.toString(),
          status: 'Active',
        });

        const url = `${this.options.apiUrl}/api/widget/search?${params}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error('Failed to load properties');
        }

        const data = await response.json();
        this.state.properties = data.properties || [];
        this.state.totalProperties = data.total || 0;
      } catch (error) {
        console.error('[SpyglassFavorites] Properties error:', error);
        this.state.error = error.message;
      } finally {
        this.state.loading = false;
        this.renderContent();
      }
    }

    showLoginPrompt() {
      this.state.currentView = 'login';
      this.renderContent();
    }

    switchView(view) {
      this.state.currentView = view;
      if (view === 'browse' && this.state.properties.length === 0) {
        this.loadProperties();
      } else {
        this.renderContent();
      }
    }

    render() {
      const hasUser = !!this.options.wpUserId;
      const logoUrl = this.options.logoUrl || (this.options.apiUrl ? `${this.options.apiUrl}/spyglass-logo-white.png` : '/spyglass-logo-white.png');
      
      this.container.innerHTML = '';
      
      const header = document.createElement('div');
      header.className = 'spyglass-favorites-header';
      
      const logo = document.createElement('img');
      logo.src = logoUrl;
      logo.alt = 'Spyglass Realty';
      logo.className = 'spyglass-favorites-header-logo';
      header.appendChild(logo);
      
      const headerContent = document.createElement('div');
      headerContent.className = 'spyglass-favorites-header-content';
      headerContent.innerHTML = `
        <h2>
          <svg class="heart-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          My Favorites
        </h2>
      `;
      header.appendChild(headerContent);
      
      if (this.options.showPropertySearch) {
        const tabs = document.createElement('div');
        tabs.className = 'spyglass-favorites-tabs';
        
        const favoritesTab = document.createElement('button');
        favoritesTab.className = 'spyglass-favorites-tab' + (this.state.currentView === 'favorites' ? ' active' : '');
        favoritesTab.setAttribute('data-view', 'favorites');
        favoritesTab.id = this.containerId + '-tab-favorites';
        favoritesTab.textContent = 'Saved (' + this.state.favorites.length + ')';
        tabs.appendChild(favoritesTab);
        
        const browseTab = document.createElement('button');
        browseTab.className = 'spyglass-favorites-tab' + (this.state.currentView === 'browse' ? ' active' : '');
        browseTab.setAttribute('data-view', 'browse');
        browseTab.id = this.containerId + '-tab-browse';
        browseTab.textContent = 'Browse';
        tabs.appendChild(browseTab);
        
        header.appendChild(tabs);
      }
      
      this.container.appendChild(header);
      
      const content = document.createElement('div');
      content.className = 'spyglass-favorites-content';
      content.id = this.containerId + '-content';
      this.container.appendChild(content);

      this.attachTabListeners();
      this.renderContent();
    }

    attachTabListeners() {
      const tabs = this.container.querySelectorAll('.spyglass-favorites-tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const view = tab.getAttribute('data-view');
          this.switchView(view);
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
        });
      });
    }

    renderContent() {
      const content = document.getElementById(`${this.containerId}-content`);
      if (!content) return;

      // Show login prompt if no user or if explicitly set to login view
      if (this.state.currentView === 'login' || (!this.options.wpUserId && this.state.currentView === 'favorites')) {
        this.renderLoginPrompt(content);
        this.attachLoginHandler();
        return;
      }

      if (this.state.loading) {
        content.innerHTML = `
          <div class="spyglass-favorites-loading">
            <div class="spinner"></div>
            <span>Loading...</span>
          </div>
        `;
        return;
      }

      if (this.state.error) {
        content.innerHTML = '';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'spyglass-error';
        const errorP = document.createElement('p');
        errorP.textContent = this.state.error;
        errorDiv.appendChild(errorP);
        const retryBtn = document.createElement('button');
        retryBtn.id = this.containerId + '-retry';
        retryBtn.textContent = 'Try Again';
        retryBtn.addEventListener('click', () => {
          if (this.state.currentView === 'favorites') {
            this.loadFavorites();
          } else {
            this.loadProperties(this.state.currentPage);
          }
        });
        errorDiv.appendChild(retryBtn);
        content.appendChild(errorDiv);
        return;
      }

      if (this.state.currentView === 'favorites') {
        this.renderFavorites(content);
      } else {
        this.renderBrowse(content);
      }
    }

    renderLoginPrompt(content) {
      content.innerHTML = '';
      
      const container = document.createElement('div');
      container.className = 'spyglass-login-prompt';
      
      const iconDiv = document.createElement('div');
      iconDiv.className = 'icon';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '48');
      svg.setAttribute('height', '48');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'currentColor');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z');
      svg.appendChild(path);
      iconDiv.appendChild(svg);
      container.appendChild(iconDiv);
      
      const h3 = document.createElement('h3');
      h3.textContent = 'Sign in to save favorites';
      container.appendChild(h3);
      
      const p = document.createElement('p');
      p.textContent = 'Create an account or sign in to save properties and view them later.';
      container.appendChild(p);
      
      const btn = document.createElement('button');
      btn.className = 'spyglass-login-btn';
      btn.id = this.containerId + '-login-btn';
      btn.textContent = 'Sign In';
      container.appendChild(btn);
      
      content.appendChild(container);
    }

    attachLoginHandler() {
      const btn = document.getElementById(`${this.containerId}-login-btn`);
      if (btn) {
        btn.addEventListener('click', () => {
          window.location.href = this.options.loginUrl;
        });
      }
    }

    renderFavorites(content) {
      if (this.state.favorites.length === 0) {
        content.innerHTML = `
          <div class="spyglass-favorites-empty">
            <div class="icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </div>
            <h3>No favorites yet</h3>
            <p>Browse properties and click the heart icon to save them here.</p>
          </div>
        `;
        return;
      }

      const properties = this.state.favorites
        .map(f => f.property)
        .filter(p => p);

      content.innerHTML = `
        <div class="spyglass-favorites-grid">
          ${properties.map(p => this.renderPropertyCard(p, true)).join('')}
        </div>
      `;

      this.attachCardListeners(content);
    }

    renderBrowse(content) {
      const totalPages = Math.ceil(this.state.totalProperties / this.options.resultsPerPage);

      content.innerHTML = `
        <div class="spyglass-favorites-grid">
          ${this.state.properties.map(p => {
            const isFavorited = this.state.favoriteIds.has(p.listingId);
            return this.renderPropertyCard(p, isFavorited);
          }).join('')}
        </div>
        ${totalPages > 1 ? this.renderPagination(totalPages) : ''}
      `;

      this.attachCardListeners(content);
      this.attachPaginationListeners(content);
    }

    renderPropertyCard(property, isFavorited) {
      const id = property.listingId || property.id;
      const price = property.listPrice || property.price;
      const address = property.streetAddress || property.address || '';
      const city = property.city || '';
      const state = property.stateOrProvince || property.state || 'TX';
      const zip = property.postalCode || property.zipCode || '';
      const beds = property.bedroomsTotal || property.bedrooms || '-';
      const baths = property.bathroomsTotalInteger || property.bathrooms || '-';
      const sqft = property.livingArea || property.squareFeet || '-';
      const status = property.standardStatus || 'Active';
      const photo = property.primaryPhoto || (property.photos?.[0]?.mediaUrl);

      const statusClass = status.toLowerCase().includes('pending') ? 'pending' : 
                         status.toLowerCase().includes('closed') || status.toLowerCase().includes('sold') ? 'sold' : '';

      return `
        <div class="spyglass-property-card" data-property-id="${id}">
          <div class="spyglass-property-image">
            ${photo ? `<img src="${photo}" alt="${address}" loading="lazy">` : '<div class="no-image">No Image</div>'}
            <span class="spyglass-property-status ${statusClass}">${status}</span>
            <button class="spyglass-favorite-btn" data-property-id="${id}" aria-label="${isFavorited ? 'Remove from favorites' : 'Add to favorites'}">
              ${isFavorited ? `
                <svg viewBox="0 0 24 24" class="heart-filled">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              ` : `
                <svg viewBox="0 0 24 24" class="heart-outline" stroke-width="2">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              `}
            </button>
          </div>
          <div class="spyglass-property-info">
            <p class="spyglass-property-price">$${Number(price).toLocaleString()}</p>
            <p class="spyglass-property-address">${address}</p>
            <p class="spyglass-property-location">${city}, ${state} ${zip}</p>
            <div class="spyglass-property-details">
              <span>${beds} beds</span>
              <span>${baths} baths</span>
              <span>${sqft !== '-' ? Number(sqft).toLocaleString() + ' sqft' : '-'}</span>
            </div>
          </div>
        </div>
      `;
    }

    renderPagination(totalPages) {
      const currentPage = this.state.currentPage;
      let pages = [];

      if (totalPages <= 7) {
        pages = Array.from({ length: totalPages }, (_, i) => i + 1);
      } else {
        if (currentPage <= 3) {
          pages = [1, 2, 3, 4, '...', totalPages];
        } else if (currentPage >= totalPages - 2) {
          pages = [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        } else {
          pages = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
        }
      }

      return `
        <div class="spyglass-pagination">
          <button ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">Previous</button>
          ${pages.map(p => p === '...' 
            ? '<span>...</span>' 
            : `<button class="${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`
          ).join('')}
          <button ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">Next</button>
        </div>
      `;
    }

    attachCardListeners(content) {
      content.querySelectorAll('.spyglass-favorite-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const propertyId = btn.getAttribute('data-property-id');
          this.toggleFavorite(propertyId);
        });
      });
    }

    attachPaginationListeners(content) {
      content.querySelectorAll('.spyglass-pagination button[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
          const page = parseInt(btn.getAttribute('data-page'));
          if (!isNaN(page)) {
            this.loadProperties(page);
          }
        });
      });
    }

    setUser(wpUserId) {
      this.options.wpUserId = wpUserId;
      this.loadFavorites();
    }

    isFavorited(propertyId) {
      return this.state.favoriteIds.has(propertyId);
    }

    destroy() {
      if (this.keyHandler) {
        document.removeEventListener('keydown', this.keyHandler);
      }
      if (this.container) {
        this.container.innerHTML = '';
        this.container.classList.remove('spyglass-favorites-widget');
      }
    }
  }

  window.SpyglassFavorites = {
    version: WIDGET_VERSION,
    init: function(containerId, options = {}) {
      const widget = new SpyglassFavoritesWidget(containerId, options);
      widget.init();
      return widget;
    },
  };
})();
