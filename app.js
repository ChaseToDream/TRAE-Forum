/**
 * TRAE Forum Posts - 主应用模块
 * 功能：URL状态同步、深色模式、虚拟滚动、键盘快捷键、本地存储、数据导出、统计图表
 */
(function() {
  'use strict';

  // ──────────────────────────────────────────
  // SVG 图标常量
  // ──────────────────────────────────────────
  const ICONS = {
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    reply: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="7"/><rect x="3" y="14" width="18" height="7"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 15l-6-6-6 6"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  };

  // ──────────────────────────────────────────
  // 配置常量
  // ──────────────────────────────────────────
  const DATA_PATH = 'data/posts.json';
  const CONFIG_PATH = 'config.json';
  const DEFAULT_CAT = { color: '#9BA3B5', soft: '#EDF0F7', icon: '📁', visible: true };
  const STORAGE_KEY = 'trae-posts-prefs';
  const DEBOUNCE_MS = 200;
  const VIRTUAL_THRESHOLD = 100; // 超过此数量启用虚拟滚动

  // ──────────────────────────────────────────
  // 应用状态
  // ──────────────────────────────────────────
  const state = {
    allPosts: [],
    filteredPosts: [],
    catConfig: {},
    activeCategory: 'all',
    searchQuery: '',
    currentSort: 'newest',
    currentView: 'columns',
    theme: 'light',
    updatedAt: '',
    showStats: false,
    calendarYear: new Date().getFullYear(),
    calendarMonth: new Date().getMonth(),
    calendarSelectedDate: null,
    refreshTimer: null,
    isRefreshing: false,
    visibilityHooked: false,
    REFRESH_INTERVAL: 5 * 60 * 1000,
  };

  // ──────────────────────────────────────────
  // 工具函数
  // ──────────────────────────────────────────
  function cc(name) { return state.catConfig[name] || DEFAULT_CAT; }

  function fmt(n) {
    if (n == null || isNaN(n)) return '0';
    n = Number(n);
    if (n >= 10000) { var v = n / 10000; return v % 1 === 0 ? v + 'w' : v.toFixed(1) + 'w'; }
    if (n >= 1000) { var v2 = n / 1000; return v2 % 1 === 0 ? v2 + 'k' : v2.toFixed(1) + 'k'; }
    return String(n);
  }

  function fmtDate(s) {
    if (!s) return '';
    var d = new Date(s);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '.' + String(d.getMonth()+1).padStart(2,'0') + '.' + String(d.getDate()).padStart(2,'0');
  }

  function timeAgo(s) {
    if (!s) return '';
    var ref = state.updatedAt ? new Date(state.updatedAt) : new Date();
    var diff = Math.floor((ref.getTime() - new Date(s).getTime()) / 1000);
    if (diff < 0) return fmtDate(s);
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff/60) + '分钟前';
    if (diff < 86400) return Math.floor(diff/3600) + '小时前';
    if (diff < 2592000) return Math.floor(diff/86400) + '天前';
    if (diff < 31536000) return Math.floor(diff/2592000) + '个月前';
    return fmtDate(s);
  }

  // 仅放行 http(s) 绝对链接，阻断 javascript: 等伪协议进入 href/src
  function safeUrl(u) {
    if (!u) return '';
    u = String(u);
    return /^https?:\/\//i.test(u) ? u : '';
  }

  function esc(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function debounce(fn, ms) {
    var timer;
    return function() {
      clearTimeout(timer);
      timer = setTimeout(fn, ms);
    };
  }

  // ──────────────────────────────────────────
  // 本地存储
  // ──────────────────────────────────────────
  function loadPrefs() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        var prefs = JSON.parse(saved);
        if (prefs.theme) state.theme = prefs.theme;
        if (prefs.currentSort) state.currentSort = prefs.currentSort;
        if (prefs.currentView) state.currentView = prefs.currentView;
      }
    } catch(e) { /* ignore */ }
  }

  function savePrefs() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        theme: state.theme,
        currentSort: state.currentSort,
        currentView: state.currentView,
      }));
    } catch(e) { /* ignore */ }
  }

  // ──────────────────────────────────────────
  // URL 状态同步
  // ──────────────────────────────────────────
  function loadFromURL() {
    var hash = window.location.hash.slice(1);
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.has('q')) state.searchQuery = params.get('q');
    if (params.has('cat')) state.activeCategory = params.get('cat');
    if (params.has('sort')) state.currentSort = params.get('sort');
    if (params.has('view')) state.currentView = params.get('view');
    if (params.has('theme')) state.theme = params.get('theme');
  }

  function saveToURL() {
    var params = new URLSearchParams();
    if (state.searchQuery) params.set('q', state.searchQuery);
    if (state.activeCategory !== 'all') params.set('cat', state.activeCategory);
    if (state.currentSort !== 'newest') params.set('sort', state.currentSort);
    if (state.currentView !== 'columns') params.set('view', state.currentView);
    if (state.theme !== 'light') params.set('theme', state.theme);
    var hash = params.toString();
    var url = window.location.pathname + (hash ? '#' + hash : '');
    history.replaceState(null, '', url);
  }

  // ──────────────────────────────────────────
  // 深色模式
  // ──────────────────────────────────────────
  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.innerHTML = theme === 'dark' ? ICONS.sun : ICONS.moon;
    savePrefs();
    saveToURL();
  }

  function toggleTheme() {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  }

  // ──────────────────────────────────────────
  // 搜索匹配
  // ──────────────────────────────────────────
  function matchSearch(p, q) {
    if (!q) return true;
    q = q.toLowerCase();
    return (p.title && p.title.toLowerCase().indexOf(q) !== -1) ||
           (p.excerpt && p.excerpt.toLowerCase().indexOf(q) !== -1) ||
           (p.category_name && p.category_name.toLowerCase().indexOf(q) !== -1);
  }

  // ──────────────────────────────────────────
  // 排序
  // ──────────────────────────────────────────
  function sortPosts(posts) {
    var sorted = posts.slice();
    var cmp = {
      newest: function(a,b) { return new Date(b.created_at) - new Date(a.created_at); },
      oldest: function(a,b) { return new Date(a.created_at) - new Date(b.created_at); },
      popular: function(a,b) { return (b.views||0) - (a.views||0); },
      likes: function(a,b) { return (b.like_count||0) - (a.like_count||0); },
      replies: function(a,b) { return (b.reply_count||0) - (a.reply_count||0); },
    };
    sorted.sort(cmp[state.currentSort] || cmp.newest);
    return sorted;
  }

  // ──────────────────────────────────────────
  // 过滤帖子
  // ──────────────────────────────────────────
  function filterPosts() {
    state.filteredPosts = state.allPosts.filter(function(p) {
      if (state.activeCategory !== 'all' && p.category_name !== state.activeCategory) return false;
      if (state.searchQuery && !matchSearch(p, state.searchQuery)) return false;
      return true;
    });
  }

  // ──────────────────────────────────────────
  // 渲染头部
  // ──────────────────────────────────────────
  function renderHeader(data) {
    var user = data.user || {};
    var avatar = document.getElementById('avatar');
    if (user.avatar_url) { avatar.src = user.avatar_url; avatar.style.display = 'block'; }
    var usernameEl = document.getElementById('username');
    var uname = user.username || '未知用户';
    if (user.username) {
      usernameEl.innerHTML = '<a href="https://forum.trae.cn/u/' + esc(user.username) + '/summary" target="_blank" rel="noopener" class="header-name-link">' + esc(uname) + '</a>';
    } else {
      usernameEl.textContent = uname;
    }

    var bh = '';
    if (user.title) bh += '<span class="header-badge">🏷 ' + esc(user.title) + '</span>';
    var ws = safeUrl(user.website);
    if (ws) bh += '<span class="header-badge">🔗 <a href="' + esc(ws) + '" target="_blank" rel="noopener">' + esc(user.website) + '</a></span>';
    document.getElementById('badges').innerHTML = bh;

    document.getElementById('stats-bar').style.display = 'flex';
    document.getElementById('stat-posts').textContent = data.total_posts || 0;

    var tv = 0, tl = 0;
    (data.posts||[]).forEach(function(p) { tv += p.views||0; tl += p.like_count||0; });
    document.getElementById('stat-views').textContent = fmt(tv);
    document.getElementById('stat-likes').textContent = fmt(tl);
    document.getElementById('stat-cats').textContent = Object.keys(data.categories||{}).length;

    if (data.updated_at) {
      state.updatedAt = data.updated_at;
      document.getElementById('update-time').textContent = '最后更新: ' + fmtDate(data.updated_at);
    }
  }

  // ──────────────────────────────────────────
  // 渲染分类标签
  // ──────────────────────────────────────────
  function updateCatTabs() {
    var list = document.getElementById('cat-list');
    var filtered = state.searchQuery
      ? state.allPosts.filter(function(p) { return matchSearch(p, state.searchQuery); })
      : state.allPosts;

    var h = '<button class="cat-tab' + (state.activeCategory === 'all' ? ' active' : '') + '" data-cat="all"><span class="dot" style="background:linear-gradient(135deg,var(--accent),var(--teal))"></span>全部 <span class="cnt">' + filtered.length + '</span></button>';

    var grouped = {};
    filtered.forEach(function(p) { grouped[p.category_name] = (grouped[p.category_name] || 0) + 1; });
    var sorted = Object.entries(grouped).sort(function(a,b){return b[1]-a[1];});
    sorted.forEach(function(e) {
      var c = cc(e[0]);
      h += '<button class="cat-tab' + (state.activeCategory === e[0] ? ' active' : '') + '" data-cat="' + esc(e[0]) + '"><span class="dot" style="background:' + c.color + '"></span>' + esc(e[0]) + ' <span class="cnt">' + e[1] + '</span></button>';
    });
    list.innerHTML = h;

    var searchResults = document.getElementById('search-results');
    if (searchResults) {
      if (state.searchQuery) {
        searchResults.textContent = filtered.length + ' 条结果';
        searchResults.style.display = 'inline-block';
      } else {
        searchResults.style.display = 'none';
      }
    }
  }

  // ──────────────────────────────────────────
  // 帖子卡片模板
  // ──────────────────────────────────────────
  function buildItem(p) {
    var c = cc(p.category_name);
    var h = '<a class="post-item" href="' + esc(safeUrl(p.url)) + '" target="_blank" rel="noopener">';
    h += '<div class="post-item-title">' + esc(p.title);
    if (p.pinned) h += '<span class="post-item-pin">📌</span>';
    h += '</div>';
    h += '<div class="post-item-meta">';
    h += '<span>' + ICONS.eye + fmt(p.views) + '</span>';
    h += '<span>' + ICONS.heart + fmt(p.like_count) + '</span>';
    h += '<span>' + timeAgo(p.created_at) + '</span>';
    h += '</div></a>';
    return h;
  }

  function buildFlatCard(p, i) {
    var c = cc(p.category_name);
    var img = safeUrl(p.image_url);
    var h = '<a class="flat-card" href="' + esc(safeUrl(p.url)) + '" target="_blank" rel="noopener" style="animation-delay:' + Math.min(i * 0.03, 0.5) + 's">';
    if (img) {
      h += '<div class="flat-card-img-wrap"><img class="flat-card-img" src="' + esc(img) + '" alt="" loading="lazy" data-cat="' + esc(p.category_name) + '"></div>';
    } else {
      h += '<div class="flat-card-placeholder" style="background:' + c.soft + '">' + c.icon + '</div>';
    }
    h += '<div class="flat-card-body">';
    h += '<span class="flat-card-cat" style="background:' + c.soft + ';color:' + c.color + '">' + esc(p.category_name) + '</span>';
    h += '<div class="flat-card-title">' + esc(p.title) + '</div>';
    if (p.excerpt) h += '<div class="flat-card-excerpt">' + esc(p.excerpt) + '</div>';
    h += '<div class="flat-card-footer">';
    h += '<div class="flat-card-stats">';
    h += '<span>' + ICONS.eye + fmt(p.views) + '</span>';
    h += '<span>' + ICONS.heart + fmt(p.like_count) + '</span>';
    h += '<span>' + ICONS.reply + fmt(p.reply_count) + '</span>';
    h += '</div>';
    h += '<span class="flat-card-date">' + timeAgo(p.created_at) + '</span>';
    h += '</div></div></a>';
    return h;
  }

  // ──────────────────────────────────────────
  // 虚拟滚动（卡片视图）
  // ──────────────────────────────────────────
  function renderFlatViewVirtual(sorted) {
    var content = document.getElementById('content');
    var CARD_HEIGHT = 320; // 估算卡片高度
    var GAP = 20;
    var containerH = window.innerHeight - 200;
    var cols = Math.max(1, Math.floor((content.clientWidth - 48) / (320 + GAP)));
    var visibleRows = Math.ceil(containerH / (CARD_HEIGHT + GAP)) + 2;
    var visibleCount = visibleRows * cols;

    var html = '<div class="flat-grid" id="virtual-container">';

    // 只渲染可见部分
    var renderCount = Math.min(sorted.length, visibleCount);
    for (var i = 0; i < renderCount; i++) {
      html += buildFlatCard(sorted[i], i);
    }
    html += '</div>';

    // 剩余占位
    if (sorted.length > renderCount) {
      var remainingH = Math.ceil((sorted.length - renderCount) / cols) * (CARD_HEIGHT + GAP);
      html += '<div id="virtual-spacer" style="height:' + remainingH + 'px"></div>';
    }

    content.innerHTML = html;

    // 懒加载剩余卡片
    if (sorted.length > renderCount) {
      var loaded = renderCount;
      var container = document.getElementById('virtual-container');
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting && loaded < sorted.length) {
            var batch = Math.min(sorted.length - loaded, cols * 2);
            var frag = document.createDocumentFragment();
            var temp = document.createElement('div');
            for (var j = 0; j < batch; j++) {
              temp.innerHTML = buildFlatCard(sorted[loaded + j], loaded + j);
              frag.appendChild(temp.firstChild);
            }
            container.appendChild(frag);
            loaded += batch;
            if (loaded >= sorted.length) {
              observer.disconnect();
              var spacer = document.getElementById('virtual-spacer');
              if (spacer) spacer.remove();
            }
          }
        });
      }, { rootMargin: '200px' });

      var spacer = document.getElementById('virtual-spacer');
      if (spacer) observer.observe(spacer);
    }
  }

  // ──────────────────────────────────────────
  // 渲染视图
  // ──────────────────────────────────────────
  function renderColumnsView(filtered) {
    var content = document.getElementById('content');
    var grouped = {};
    filtered.forEach(function(p) {
      if (!grouped[p.category_name]) grouped[p.category_name] = [];
      grouped[p.category_name].push(p);
    });
    var sortedCats = Object.entries(grouped).sort(function(a,b){return b[1].length - a[1].length;});
    var h = '<div class="cat-columns">';
    sortedCats.forEach(function(entry, ci) {
      var catName = entry[0];
      var posts = sortPosts(entry[1]);
      var c = cc(catName);
      h += '<div class="cat-col" style="animation-delay:' + (ci * 0.06) + 's">';
      h += '<div class="cat-col-header">';
      h += '<span class="cat-col-dot" style="background:' + c.color + '"></span>';
      h += '<span class="cat-col-name">' + c.icon + ' ' + esc(catName) + '</span>';
      h += '<span class="cat-col-count">' + posts.length + '</span>';
      h += '</div>';
      h += '<div class="cat-col-body">';
      posts.forEach(function(p) { h += buildItem(p); });
      h += '</div></div>';
    });
    h += '</div>';
    content.innerHTML = h;
  }

  function renderFlatView(filtered) {
    var sorted = sortPosts(filtered);
    if (sorted.length > VIRTUAL_THRESHOLD) {
      renderFlatViewVirtual(sorted);
    } else {
      var content = document.getElementById('content');
      var h = '<div class="flat-grid">';
      sorted.forEach(function(p, i) { h += buildFlatCard(p, i); });
      h += '</div>';
      content.innerHTML = h;
    }
  }

  function renderCalendarView(filtered) {
    var content = document.getElementById('content');
    var year = state.calendarYear;
    var month = state.calendarMonth;
    var today = new Date();
    var todayStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');

    var postsByDate = {};
    filtered.forEach(function(p) {
      if (p.created_at) {
        var d = new Date(p.created_at);
        var key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        if (!postsByDate[key]) postsByDate[key] = [];
        postsByDate[key].push(p);
      }
    });

    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var daysInPrevMonth = new Date(year, month, 0).getDate();
    var monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

    var h = '<div class="cal-view">';
    h += '<div class="cal-header">';
    h += '<button class="cal-nav-btn" id="cal-prev">' + ICONS.up + '</button>';
    h += '<span class="cal-month-title">' + year + '年 ' + monthNames[month] + '</span>';
    h += '<button class="cal-nav-btn" id="cal-next">' + ICONS.up + '</button>';
    h += '</div>';
    h += '<div class="cal-weekdays">';
    var weekdays = ['日','一','二','三','四','五','六'];
    weekdays.forEach(function(w) { h += '<div class="cal-weekday">' + w + '</div>'; });
    h += '</div>';
    h += '<div class="cal-grid">';

    var totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    for (var i = 0; i < totalCells; i++) {
      var dayNum, dateKey, isOther = false;
      if (i < firstDay) {
        dayNum = daysInPrevMonth - firstDay + 1 + i;
        var pm = month === 0 ? 11 : month - 1;
        var py = month === 0 ? year - 1 : year;
        dateKey = py + '-' + String(pm+1).padStart(2,'0') + '-' + String(dayNum).padStart(2,'0');
        isOther = true;
      } else if (i >= firstDay + daysInMonth) {
        dayNum = i - firstDay - daysInMonth + 1;
        var nm = month === 11 ? 0 : month + 1;
        var ny = month === 11 ? year + 1 : year;
        dateKey = ny + '-' + String(nm+1).padStart(2,'0') + '-' + String(dayNum).padStart(2,'0');
        isOther = true;
      } else {
        dayNum = i - firstDay + 1;
        dateKey = year + '-' + String(month+1).padStart(2,'0') + '-' + String(dayNum).padStart(2,'0');
      }

      var posts = postsByDate[dateKey] || [];
      var isToday = dateKey === todayStr;
      var isSelected = state.calendarSelectedDate === dateKey;
      var cls = 'cal-day';
      if (isOther) cls += ' cal-day-other';
      if (posts.length) cls += ' cal-day-has-posts';
      else cls += ' cal-day-empty';
      if (isToday) cls += ' cal-today';
      if (isSelected) cls += ' cal-day-selected';

      h += '<div class="' + cls + '" data-date="' + dateKey + '">';
      h += '<span class="cal-day-num">' + dayNum + '</span>';
      if (posts.length) {
        var catSet = {};
        posts.forEach(function(p) { catSet[p.category_name] = true; });
        h += '<div class="cal-day-dots">';
        Object.keys(catSet).forEach(function(cn) {
          h += '<span class="cal-dot" style="background:' + cc(cn).color + '"></span>';
        });
        h += '</div>';
        h += '<span class="cal-day-count">' + posts.length + '</span>';
      }
      h += '</div>';
    }
    h += '</div>';

    if (state.calendarSelectedDate && postsByDate[state.calendarSelectedDate]) {
      var selPosts = sortPosts(postsByDate[state.calendarSelectedDate]);
      h += '<div class="cal-day-posts">';
      h += '<div class="cal-day-posts-title">' + state.calendarSelectedDate + ' · ' + selPosts.length + '篇帖子</div>';
      selPosts.forEach(function(p) { h += buildItem(p); });
      h += '</div>';
    }

    h += '</div>';
    content.innerHTML = h;

    document.getElementById('cal-prev').addEventListener('click', function() {
      state.calendarMonth--;
      if (state.calendarMonth < 0) { state.calendarMonth = 11; state.calendarYear--; }
      state.calendarSelectedDate = null;
      renderPosts();
    });
    document.getElementById('cal-next').addEventListener('click', function() {
      state.calendarMonth++;
      if (state.calendarMonth > 11) { state.calendarMonth = 0; state.calendarYear++; }
      state.calendarSelectedDate = null;
      renderPosts();
    });

    content.querySelectorAll('.cal-day-has-posts').forEach(function(el) {
      el.addEventListener('click', function() {
        var date = this.dataset.date;
        state.calendarSelectedDate = state.calendarSelectedDate === date ? null : date;
        renderPosts();
      });
    });
  }

  function renderPosts() {
    filterPosts();
    var content = document.getElementById('content');
    if (!state.filteredPosts.length) {
      content.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>暂无匹配的帖子</p></div>';
      return;
    }
    if (state.currentView === 'calendar') {
      renderCalendarView(state.filteredPosts);
    } else if (state.currentView === 'columns' && state.activeCategory === 'all') {
      renderColumnsView(state.filteredPosts);
    } else {
      renderFlatView(state.filteredPosts);
    }
  }

  // ──────────────────────────────────────────
  // 统计图表
  // ──────────────────────────────────────────
  function renderStats() {
    var panel = document.getElementById('stats-panel');
    if (!panel) return;

    if (state.showStats) {
      panel.classList.add('show');
      renderCharts();
    } else {
      panel.classList.remove('show');
    }
  }

  function renderCharts() {
    if (typeof Chart === 'undefined') return;

    // 分类分布饼图
    var catCtx = document.getElementById('chart-categories');
    if (catCtx && catCtx.getContext) {
      var catData = {};
      state.allPosts.forEach(function(p) {
        catData[p.category_name] = (catData[p.category_name] || 0) + 1;
      });
      var labels = Object.keys(catData);
      var data = Object.values(catData);
      var colors = labels.map(function(l) { return cc(l).color; });

      if (catCtx._chart) catCtx._chart.destroy();
      catCtx._chart = new Chart(catCtx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{ data: data, backgroundColor: colors, borderWidth: 0 }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true } }
          }
        }
      });
    }

    // 发帖时间线
    var timeCtx = document.getElementById('chart-timeline');
    if (timeCtx && timeCtx.getContext) {
      var monthly = {};
      state.allPosts.forEach(function(p) {
        if (p.created_at) {
          var d = new Date(p.created_at);
          var key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
          monthly[key] = (monthly[key] || 0) + 1;
        }
      });
      var timeLabels = Object.keys(monthly).sort();
      var timeData = timeLabels.map(function(k) { return monthly[k]; });

      if (timeCtx._chart) timeCtx._chart.destroy();
      timeCtx._chart = new Chart(timeCtx, {
        type: 'bar',
        data: {
          labels: timeLabels,
          datasets: [{
            label: '发帖数',
            data: timeData,
            backgroundColor: 'rgba(79, 110, 247, 0.6)',
            borderRadius: 4,
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1 } }
          }
        }
      });
    }
  }

  // ──────────────────────────────────────────
  // 数据导出
  // ──────────────────────────────────────────
  function exportData(format) {
    var data = state.filteredPosts;
    if (!data.length) return;

    var content, filename, mime;

    if (format === 'csv') {
      var headers = ['ID', '标题', '分类', '创建时间', '浏览', '点赞', '回复', '链接'];
      function csvField(v) {
        v = v == null ? '' : String(v);
        // 以 = + - @ 开头的值会被 Excel 当公式执行，前缀单引号强制按文本处理
        if (/^[=+\-@\t]/.test(v)) v = "'" + v;
        if (/[",\r\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
        return v;
      }
      var rows = data.map(function(p) {
        return [p.id, p.title, p.category_name, p.created_at, p.views, p.like_count, p.reply_count, p.url].map(csvField).join(',');
      });
      content = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
      filename = 'trae-posts.csv';
      mime = 'text/csv;charset=utf-8';
    } else {
      content = JSON.stringify(data, null, 2);
      filename = 'trae-posts.json';
      mime = 'application/json;charset=utf-8';
    }

    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ──────────────────────────────────────────
  // 键盘快捷键
  // ──────────────────────────────────────────
  function setupKeyboard() {
    document.addEventListener('keydown', function(e) {
      // 放行带修饰键的组合（Ctrl+R 刷新、Ctrl+D 收藏、Ctrl+S 保存等浏览器行为）
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // 忽略输入框内的按键
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        if (e.key === 'Escape') {
          e.target.blur();
          document.getElementById('search-clear').click();
        }
        return;
      }

      switch(e.key) {
        case '/':
          e.preventDefault();
          document.getElementById('search-input').focus();
          break;
        case '1':
          e.preventDefault();
          document.getElementById('view-columns').click();
          break;
        case '2':
          e.preventDefault();
          document.getElementById('view-flat').click();
          break;
        case '3':
          e.preventDefault();
          document.getElementById('view-calendar').click();
          break;
        case 'd':
        case 'D':
          e.preventDefault();
          toggleTheme();
          break;
        case 's':
        case 'S':
          e.preventDefault();
          state.showStats = !state.showStats;
          renderStats();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          refreshData();
          break;
        case 'Escape':
          document.getElementById('search-clear').click();
          state.showStats = false;
          renderStats();
          break;
      }
    });
  }

  // ──────────────────────────────────────────
  // 视图切换
  // ──────────────────────────────────────────
  function setView(view) {
    state.currentView = view;
    if (view === 'calendar') state.calendarSelectedDate = null;
    document.getElementById('view-columns').classList.toggle('active', view === 'columns');
    document.getElementById('view-flat').classList.toggle('active', view === 'flat');
    document.getElementById('view-calendar').classList.toggle('active', view === 'calendar');
    renderPosts();
    savePrefs();
    saveToURL();
  }

  // ──────────────────────────────────────────
  // 事件绑定
  // ──────────────────────────────────────────
  function setupEvents() {
    // 搜索
    var si = document.getElementById('search-input');
    var doSearch = debounce(function() {
      state.searchQuery = si.value.trim();
      document.getElementById('search-clear').classList.toggle('show', state.searchQuery.length > 0);
      updateCatTabs();
      renderPosts();
      saveToURL();
    }, DEBOUNCE_MS);
    si.addEventListener('input', doSearch);

    // 清除搜索
    document.getElementById('search-clear').addEventListener('click', function() {
      si.value = '';
      state.searchQuery = '';
      this.classList.remove('show');
      updateCatTabs();
      renderPosts();
      saveToURL();
      si.focus();
    });

    // 分类标签
    document.getElementById('cat-list').addEventListener('click', function(e) {
      var btn = e.target.closest('.cat-tab');
      if (!btn) return;
      state.activeCategory = btn.dataset.cat;
      document.querySelectorAll('.cat-tab').forEach(function(el) { el.classList.remove('active'); });
      btn.classList.add('active');
      updateCatTabs();
      renderPosts();
      saveToURL();
    });

    // 排序
    var sortSelect = document.getElementById('sort-select');
    sortSelect.value = state.currentSort;
    sortSelect.addEventListener('change', function() {
      state.currentSort = this.value;
      renderPosts();
      savePrefs();
      saveToURL();
    });

    // 视图切换
    document.getElementById('view-columns').addEventListener('click', function() { setView('columns'); });
    document.getElementById('view-flat').addEventListener('click', function() { setView('flat'); });
    document.getElementById('view-calendar').addEventListener('click', function() { setView('calendar'); });

    // 主题切换
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // 刷新数据
    document.getElementById('refresh-btn').addEventListener('click', refreshData);

    // 导出按钮
    document.getElementById('export-csv').addEventListener('click', function() { exportData('csv'); });
    document.getElementById('export-json').addEventListener('click', function() { exportData('json'); });

    // 统计面板
    document.getElementById('stats-toggle').addEventListener('click', function() {
      state.showStats = !state.showStats;
      renderStats();
    });
    document.getElementById('stats-close').addEventListener('click', function() {
      state.showStats = false;
      renderStats();
    });

    // 滚动效果
    var header = document.getElementById('site-header');
    window.addEventListener('scroll', function() {
      header.classList.toggle('scrolled', window.scrollY > 4);
      document.getElementById('back-top').classList.toggle('show', window.scrollY > 300);
    }, { passive: true });

    document.getElementById('back-top').addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 卡片图片加载失败时替换为分类占位块（error 不冒泡，用捕获阶段委托）
    document.addEventListener('error', function(e) {
      var img = e.target;
      if (!img || !img.classList || !img.classList.contains('flat-card-img')) return;
      var wrap = img.parentElement;
      if (!wrap) return;
      var cfg = cc(img.dataset.cat || '');
      var ph = document.createElement('div');
      ph.className = 'flat-card-placeholder';
      ph.style.background = cfg.soft;
      ph.textContent = cfg.icon;
      wrap.replaceWith(ph);
    }, true);

    // URL hash 变化
    window.addEventListener('hashchange', function() {
      loadFromURL();
      applyTheme(state.theme);
      document.getElementById('search-input').value = state.searchQuery;
      document.getElementById('sort-select').value = state.currentSort;
      setView(state.currentView);
      updateCatTabs();
    });
  }

  // ──────────────────────────────────────────
  // 数据刷新
  // ──────────────────────────────────────────
  function refreshData() {
    if (state.isRefreshing) return;
    state.isRefreshing = true;

    var btn = document.getElementById('refresh-btn');
    if (btn) btn.classList.add('spinning');

    fetch(DATA_PATH + '?t=' + Date.now())
      .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function(data) {
        if (!data || !data.posts) return;

        state.allPosts = data.posts || [];

        if (data.updated_at) {
          state.updatedAt = data.updated_at;
          document.getElementById('update-time').textContent = '最后更新: ' + fmtDate(data.updated_at);
        }

        renderHeader(data);
        updateCatTabs();
        renderPosts();
      })
      .catch(function(e) { console.warn('刷新数据失败:', e); })
      .finally(function() {
        state.isRefreshing = false;
        if (btn) btn.classList.remove('spinning');
      });
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    state.refreshTimer = setInterval(refreshData, state.REFRESH_INTERVAL);
  }

  function stopAutoRefresh() {
    if (state.refreshTimer) {
      clearInterval(state.refreshTimer);
      state.refreshTimer = null;
    }
  }

  function showError(msg) {
    var content = document.getElementById('content');
    content.style.opacity = '1';
    content.innerHTML = '<div class="error-state"><h3>⚠️ 加载失败</h3><p>' + esc(msg) + '</p><p style="margin-top:10px;font-size:0.8rem">请稍后重试，或访问 <a href="https://forum.trae.cn/" target="_blank" rel="noopener">TRAE官方论坛</a></p><button id="retry-btn" class="retry-btn">🔄 重试加载</button></div>';
    var retry = document.getElementById('retry-btn');
    if (retry) retry.addEventListener('click', function() { loadData(); });
  }

  // ──────────────────────────────────────────
  // 初始化
  // ──────────────────────────────────────────
  function init() {
    // 加载偏好和 URL 状态
    loadPrefs();
    loadFromURL();

    // 应用主题
    applyTheme(state.theme);

    // 应用视图状态
    if (state.currentView === 'flat') {
      document.getElementById('view-flat').classList.add('active');
      document.getElementById('view-columns').classList.remove('active');
      document.getElementById('view-calendar').classList.remove('active');
    } else if (state.currentView === 'calendar') {
      document.getElementById('view-calendar').classList.add('active');
      document.getElementById('view-columns').classList.remove('active');
      document.getElementById('view-flat').classList.remove('active');
    }

    // 设置事件
    setupEvents();
    setupKeyboard();

    // 加载数据
    loadData();
  }

  function loadData() {
    var content = document.getElementById('content');
    content.style.opacity = '0';
    content.style.transition = 'opacity 0.3s ease';

    fetch(CONFIG_PATH)
      .then(function(r) { if (!r.ok) return {}; return r.json(); })
      .then(function(cfg) {
        state.catConfig = (cfg && cfg.categories) || {};
        return fetch(DATA_PATH + '?t=' + Date.now());
      })
      .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function(data) {
        if (!data || !data.posts) throw new Error('数据格式异常');
        state.allPosts = data.posts || [];

        renderHeader(data);
        updateCatTabs();
        renderPosts();

        document.getElementById('toolbar').style.display = '';

        startAutoRefresh();
        if (!state.visibilityHooked) {
          state.visibilityHooked = true;
          document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
              stopAutoRefresh();
            } else {
              refreshData();
              startAutoRefresh();
            }
          });
        }

        setTimeout(function() { content.style.opacity = '1'; }, 50);
      })
      .catch(function(e) {
        console.error(e);
        showError('无法加载数据: ' + e.message);
      });
  }

  // 启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
