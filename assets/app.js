/* ============================================================
   FOOTBALL DRAFT · 足球分队系统  v3
   球员库 / 比赛档案 / 单场数据 / 统计排行
   纯前端，数据只存在 localStorage
   ============================================================ */
(() => {
  'use strict';

  const MIN_TEAMS = 2;
  const MAX_TEAMS = 12;
  const MAX_PLAYERS = 300;
  const SAVE_DELAY = 450;

  const LS_KEY = 'football-draft:state:v3';
  const OLD_KEY = 'football-draft:state:v1';
  const V2_BACKUP_KEY = 'football-draft:state:v2-backup';
  const PRE_IMPORT_KEY = 'football-draft:state:pre-import-backup';

  const COLORS = [
    '#c8ff3d', '#43e6ff', '#ffc23d', '#ff5a52',
    '#b48bff', '#3ddc97', '#ff8ad8', '#ffa25a',
    '#7ea6ff', '#e6e6e6', '#9fe870', '#ff6b9d',
  ];
  const COLOR_NAMES = [
    '绿队', '蓝队', '黄队', '红队',
    '紫队', '青队', '粉队', '橙队',
    '天蓝队', '白队', '草绿队', '玫红队',
  ];
  const DEMO_PLAYERS = [
    '张伟', '李强', '王磊', '刘洋', '陈涛', '杨帆',
    '赵鹏', '黄鑫', '周宇', '吴迪', '徐亮', '孙浩',
    '马超', '朱峰', '胡军', '郭鑫', '何俊', '高翔',
  ];

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const els = {
    appTabs: $('#app-tabs'),
    views: $$('.app-view'),
    storageMeter: $('#storage-meter'),
    smFill: $('#sm-fill'),
    smText: $('#sm-text'),
    btnStorageBackup: $('#btn-storage-backup'),
    viewbar: $('#viewbar'),
    btnAdopt: $('#btn-adopt'),
    btnExitView: $('#btn-exit-view'),

    // HUD
    hudPlayers: $('#hud-players'),
    hudTeams: $('#hud-teams'),
    hudPool: $('#hud-pool'),
    hudSave: $('#hud-save'),
    btnUndo: $('#btn-undo'),
    btnShare: $('#btn-share'),
    btnBackup: $('#btn-backup'),
    btnReset: $('#btn-reset'),

    // 比赛视图
    matchSelect: $('#match-select'),
    btnNewMatch: $('#btn-new-match'),
    btnMatchSettings: $('#btn-match-settings'),
    btnDeleteMatch: $('#btn-delete-match'),
    matchMeta: $('#match-meta'),
    matchVenue: $('#match-venue'),
    matchKickoff: $('#match-kickoff'),
    matchOpponent: $('#match-opponent'),
    matchClear: $('#match-clear'),
    ssTeams: $('#ss-teams'),
    ssResult: $('#ss-result'),
    rosterList: $('#roster-list'),
    rosterCount: $('#roster-count'),
    playerForm: $('#player-form'),
    playerInput: $('#player-input'),
    search: $('#roster-search'),
    btnFromLibrary: $('#btn-from-library'),
    btnBatch: $('#btn-batch'),
    btnClearRoster: $('#btn-clear-roster'),
    teams: $('#teams'),
    boardEmpty: $('#board-empty'),
    boardSub: $('#board-sub'),
    teamCount: $('#team-count'),
    btnShuffle: $('#btn-shuffle'),
    btnClearTeams: $('#btn-clear-teams'),
    btnDemo: $('#btn-demo'),
    pool: $('#pool'),
    trayCount: $('#tray-count'),

    // 球员库视图
    btnPlayerAdd: $('#btn-player-add'),
    btnPlayerBatch: $('#btn-player-batch'),
    btnImport: $('#btn-import'),
    libSearch: $('#lib-search'),
    librarySummary: $('#library-summary'),
    libraryBody: $('#library-body'),
    libCheckAll: $('#lib-check-all'),
    libSelected: $('#lib-selected'),
    btnRegisterSelected: $('#btn-register-selected'),
    btnRegisterActive: $('#btn-register-active'),

    // 比赛档案视图
    btnArchiveNew: $('#btn-archive-new'),
    archiveType: $('#archive-type'),
    archivePeriod: $('#archive-period'),
    archiveSummary: $('#archive-summary'),
    matchCards: $('#match-cards'),

    // 统计视图
    statsPeriod: $('#stats-period'),
    statsType: $('#stats-type'),
    btnStatsCsv: $('#btn-stats-csv'),
    statsNote: $('#stats-note'),
    overviewCards: $('#overview-cards'),
    leaderboards: $('#leaderboards'),

    // 对话框
    dialogBatch: $('#dialog-batch'),
    batchTitle: $('#batch-title'),
    batchText: $('#batch-text'),
    batchOk: $('#batch-ok'),
    dialogLibrary: $('#dialog-library'),
    pickerSearch: $('#picker-search'),
    pickerList: $('#picker-list'),
    pickerOk: $('#picker-ok'),
    dialogPlayer: $('#dialog-player'),
    playerDialogTitle: $('#player-dialog-title'),
    pdName: $('#pd-name'),
    pdNumber: $('#pd-number'),
    pdPosition: $('#pd-position'),
    pdJoined: $('#pd-joined'),
    pdNote: $('#pd-note'),
    pdActive: $('#pd-active'),
    playerOk: $('#player-ok'),
    dialogMatch: $('#dialog-match'),
    matchDialogTitle: $('#match-dialog-title'),
    mdDate: $('#md-date'),
    mdType: $('#md-type'),
    mdVenue: $('#md-venue'),
    mdKickoff: $('#md-kickoff'),
    mdOpponent: $('#md-opponent'),
    mdNote: $('#md-note'),
    mdCopySquad: $('#md-copy-squad'),
    matchOk: $('#match-ok'),
    dialogMerge: $('#dialog-merge'),
    mergeSource: $('#merge-source'),
    mergeTarget: $('#merge-target'),
    mergeOk: $('#merge-ok'),
    dialogBackup: $('#dialog-backup'),
    backupMeta: $('#backup-meta'),
    backupDownload: $('#backup-download'),
    backupCsv: $('#backup-csv'),
    backupImportCover: $('#backup-import-cover'),
    backupImportMerge: $('#backup-import-merge'),
    dialogShare: $('#dialog-share'),
    shareUrl: $('#share-url'),
    shareMeta: $('#share-meta'),
    shareCopy: $('#share-copy'),
    dialogConfirm: $('#dialog-confirm'),
    confirmTitle: $('#confirm-title'),
    confirmText: $('#confirm-text'),
    confirmOk: $('#confirm-ok'),
    importFile: $('#import-file'),
    importFile2: $('#import-file-2'),
    toasts: $('#toasts'),
  };

  /* ==========================================================
     状态
     ========================================================== */
  let state = emptyState();
  let activeView = 'match';
  let selectedId = null;
  let undoStack = [];
  let readOnly = false;
  let saveTimer = null;
  let suppressClickUntil = 0;
  let batchMode = 'squad';      // 'squad' | 'library'
  let editingPlayerId = null;
  let editingMatchId = null;
  let mergeSourceId = null;
  let importMode = 'cover';     // 'cover' | 'merge'
  let libChecked = new Set();
  let pickerChecked = new Set();
  let expandedCards = new Set();
  let localStateBeforePreview = null;   // 只读预览前保存本地真实状态

  function today() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function emptyState() {
    return {
      version: 3,
      updatedAt: null,
      seq: { player: 0, team: 0, match: 0 },
      roster: {},
      matches: {},
      currentMatchId: null,
      settings: { minAppearances: 0 },
    };
  }

  function defaultStats() {
    return { present: true, goals: 0, assists: 0, mvp: false, svp: false, cleanSheet: false };
  }

  function newMatch(opts = {}) {
    const s = opts.state || state;
    s.seq.match += 1;
    const id = `m${s.seq.match}`;
    const teams = [];
    for (let i = 0; i < MIN_TEAMS; i += 1) teams.push(makeTeam(teams, s));
    return {
      id,
      date: opts.date || today(),
      type: opts.type || 'internal',
      venue: opts.venue || '',
      kickoff: opts.kickoff || '',
      opponent: opts.opponent || '',
      note: opts.note || '',
      teams,
      pool: [],
      scores: {},
      opponentScore: null,
      stats: {},
    };
  }

  function makeTeam(teams, s) {
    s.seq.team += 1;
    const slot = teams.length;
    const ci = slot % COLORS.length;
    const used = new Set(teams.map((t) => t.name));
    let name = COLOR_NAMES[ci];
    if (used.has(name)) name = `球队${slot + 1}`;
    if (used.has(name)) name = `球队${slot + 1}-${s.seq.team}`;
    return { id: `t${s.seq.team}`, name, color: COLORS[ci], players: [] };
  }

  function cur() {
    return state.matches[state.currentMatchId] || null;
  }

  function rosterName(pid) {
    const p = state.roster[pid];
    return p ? p.name : '(已删除)';
  }

  function squadPids(m) {
    return m ? Object.keys(m.stats) : [];
  }

  function inSquad(m, pid) {
    if (!m) return false;
    return m.teams.some((t) => t.players.includes(pid)) || m.pool.includes(pid);
  }

  function teamOf(m, pid) {
    return m ? m.teams.find((t) => t.players.includes(pid)) || null : null;
  }

  function isPresent(m, pid) {
    if (!inSquad(m, pid)) return false;
    const st = m.stats[pid];
    return st ? st.present !== false : true;
  }

  /* ==========================================================
     校验 / 归一化 / 迁移
     ========================================================== */
  function str(v, limit) {
    return typeof v === 'string' ? v.trim().slice(0, limit) : '';
  }

  function intOrNull(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= 99 ? n : null;
  }

  function normalizeColor(value, fallback) {
    if (typeof value !== 'string') return fallback;
    const hex = value.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(hex)) return hex;
    if (/^#[0-9a-f]{3}$/.test(hex)) return '#' + hex.slice(1).split('').map((c) => c + c).join('');
    return fallback;
  }

  const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

  function normalizeV3(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const s = emptyState();
    const seq = raw.seq && typeof raw.seq === 'object' ? raw.seq : {};
    const suffix = (v) => { const m = /(\d+)$/.exec(String(v)); return m ? Number(m[1]) : 0; };

    // roster
    const rawRoster = raw.roster && typeof raw.roster === 'object' ? raw.roster : {};
    Object.keys(rawRoster).slice(0, MAX_PLAYERS).forEach((pid) => {
      if (!ID_RE.test(pid)) return;
      const item = rawRoster[pid];
      if (!item || typeof item !== 'object') return;
      const name = str(item.name, 24);
      if (!name) return;
      s.roster[pid] = {
        id: pid,
        name,
        number: str(item.number, 5),
        position: ['GK', 'DF', 'MF', 'FW'].includes(item.position) ? item.position : '',
        joinedAt: DATE_RE.test(String(item.joinedAt || '')) ? String(item.joinedAt) : '',
        active: item.active !== false,
        note: str(item.note, 100),
      };
    });

    // matches
    const rawMatches = raw.matches && typeof raw.matches === 'object' ? raw.matches : {};
    Object.keys(rawMatches).forEach((mid) => {
      if (!ID_RE.test(mid)) return;
      const item = rawMatches[mid];
      if (!item || typeof item !== 'object') return;
      const m = {
        id: mid,
        date: DATE_RE.test(String(item.date || '')) ? String(item.date).slice(0, 10) : '',
        type: item.type === 'external' ? 'external' : 'internal',
        venue: str(item.venue, 40),
        kickoff: str(item.kickoff, 32),
        opponent: str(item.opponent, 40),
        note: str(item.note, 100),
        teams: [],
        pool: [],
        scores: {},
        opponentScore: null,
        stats: {},
      };
      const seenTeams = new Set();
      (Array.isArray(item.teams) ? item.teams : []).slice(0, MAX_TEAMS).forEach((t, i) => {
        if (!t || typeof t !== 'object') return;
        const tid = ID_RE.test(String(t.id || '')) && !seenTeams.has(String(t.id))
          ? String(t.id) : `t${i + 1}-${Math.random().toString(36).slice(2, 6)}`;
        seenTeams.add(tid);
        m.teams.push({
          id: tid,
          name: str(t.name, 16) || `球队${i + 1}`,
          color: normalizeColor(t.color, COLORS[i % COLORS.length]),
          players: [],
        });
      });
      if (!m.teams.length) {
        for (let i = 0; i < MIN_TEAMS; i += 1) m.teams.push(makeTeam(m.teams, s));
      }

      const used = new Set();
      const addTo = (team, pid) => {
        if (typeof pid !== 'string' || !s.roster[pid] || used.has(pid)) return;
        used.add(pid);
        team.players.push(pid);
      };
      m.teams.forEach((t, i) => {
        const source = Array.isArray(item.teams[i] && item.teams[i].players) ? item.teams[i].players : [];
        source.forEach((pid) => addTo(t, pid));
      });
      (Array.isArray(item.pool) ? item.pool : []).forEach((pid) => {
        if (typeof pid === 'string' && s.roster[pid] && !used.has(pid)) {
          used.add(pid);
          m.pool.push(pid);
        }
      });

      const rawScores = item.scores && typeof item.scores === 'object' ? item.scores : {};
      m.teams.forEach((t) => {
        const v = intOrNull(rawScores[t.id]);
        if (v !== null) m.scores[t.id] = v;
      });
      m.opponentScore = intOrNull(item.opponentScore);

      used.forEach((pid) => {
        const st = item.stats && typeof item.stats === 'object' ? item.stats[pid] : null;
        const present = !st || st.present !== false;
        m.stats[pid] = {
          present,
          goals: present ? (intOrNull(st && st.goals) || 0) : 0,
          assists: present ? (intOrNull(st && st.assists) || 0) : 0,
          mvp: present ? Boolean(st && st.mvp) : false,
          svp: present ? Boolean(st && st.svp) : false,
          cleanSheet: present ? Boolean(st && st.cleanSheet) : false,
        };
      });

      s.matches[mid] = m;
    });

    s.seq.player = Math.max(Number(seq.player) || 0, ...Object.keys(s.roster).map(suffix), 0);
    s.seq.team = Math.max(Number(seq.team) || 0, ...Object.values(s.matches).flatMap((m) => m.teams.map((t) => suffix(t.id))), 0);
    s.seq.match = Math.max(Number(seq.match) || 0, ...Object.keys(s.matches).map(suffix), 0);

    if (raw.currentMatchId && s.matches[raw.currentMatchId]) {
      s.currentMatchId = raw.currentMatchId;
    } else {
      const ids = Object.keys(s.matches);
      s.currentMatchId = ids.length ? ids[ids.length - 1] : null;
    }
    s.updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : null;
    s.settings = { minAppearances: 0 };
    return s;
  }

  function validateState(s) {
    const errors = [];
    if (!s || typeof s !== 'object') return ['状态对象无效'];
    if (s.version !== 3) errors.push('版本不是 3');
    if (!s.matches || typeof s.matches !== 'object') errors.push('缺少 matches');
    if (!s.roster || typeof s.roster !== 'object') errors.push('缺少 roster');

    Object.values(s.matches || {}).forEach((m) => {
      const squad = new Set(Object.keys(m.stats || {}));
      const located = new Set();
      (m.teams || []).forEach((t) => (t.players || []).forEach((pid) => located.add(pid)));
      (m.pool || []).forEach((pid) => located.add(pid));
      located.forEach((pid) => {
        if (!s.roster[pid]) errors.push(`${m.id}: 球员 ${pid} 不在球员库`);
        if (!squad.has(pid)) errors.push(`${m.id}: 球员 ${pid} 缺少单场记录`);
      });
      squad.forEach((pid) => {
        if (!located.has(pid)) errors.push(`${m.id}: 球员 ${pid} 有记录但未入选`);
      });
      const mvp = Object.values(m.stats || {}).filter((st) => st.mvp).length;
      const svp = Object.values(m.stats || {}).filter((st) => st.svp).length;
      if (mvp > 1) errors.push(`${m.id}: MVP 多于 1 个`);
      if (svp > 1) errors.push(`${m.id}: SVP 多于 1 个`);
    });
    if (s.currentMatchId && !s.matches[s.currentMatchId]) {
      errors.push('currentMatchId 指向不存在的比赛');
    }
    return errors;
  }

  function migrateV2(raw) {
    const s = emptyState();
    const oldPlayers = raw.players && typeof raw.players === 'object' ? raw.players : {};
    Object.keys(oldPlayers).forEach((pid) => {
      const name = str(oldPlayers[pid] && oldPlayers[pid].name, 24);
      if (!name) return;
      s.roster[pid] = { id: pid, name, number: '', position: '', joinedAt: '', active: true, note: '' };
    });

    s.seq.match = 1;
    const m = {
      id: 'm1',
      date: '',
      type: str(raw.match && raw.match.opponent, 40) ? 'external' : 'internal',
      venue: str(raw.match && raw.match.venue, 40),
      kickoff: str(raw.match && raw.match.kickoff, 32),
      opponent: str(raw.match && raw.match.opponent, 40),
      note: '',
      teams: [],
      pool: [],
      scores: {},
      opponentScore: null,
      stats: {},
    };
    if (DATE_RE.test(m.kickoff)) m.date = m.kickoff.slice(0, 10);

    const used = new Set();
    const rawTeams = Array.isArray(raw.teams) ? raw.teams : [];
    rawTeams.slice(0, MAX_TEAMS).forEach((t, i) => {
      if (!t || typeof t !== 'object') return;
      const tid = ID_RE.test(String(t.id || '')) ? String(t.id) : `t${i + 1}`;
      const team = {
        id: tid,
        name: str(t.name, 16) || `球队${i + 1}`,
        color: normalizeColor(t.color, COLORS[i % COLORS.length]),
        players: [],
      };
      (Array.isArray(t.players) ? t.players : []).forEach((pid) => {
        if (s.roster[pid] && !used.has(pid)) { used.add(pid); team.players.push(pid); }
      });
      m.teams.push(team);
    });
    if (!m.teams.length) {
      for (let i = 0; i < MIN_TEAMS; i += 1) m.teams.push(makeTeam(m.teams, s));
    }
    (Array.isArray(raw.pool) ? raw.pool : []).forEach((pid) => {
      if (s.roster[pid] && !used.has(pid)) { used.add(pid); m.pool.push(pid); }
    });
    Object.keys(s.roster).forEach((pid) => {
      if (!used.has(pid)) { used.add(pid); m.pool.push(pid); }
    });
    used.forEach((pid) => { m.stats[pid] = defaultStats(); });

    s.matches.m1 = m;
    s.currentMatchId = 'm1';
    s.seq.player = Math.max(0, ...Object.keys(s.roster).map((v) => Number(String(v).replace(/\D/g, '')) || 0));
    s.seq.team = Math.max(0, ...m.teams.map((t) => Number(String(t.id).replace(/\D/g, '')) || 0));
    return s;
  }

  function loadState() {
    let raw = null;
    let from = '';
    try {
      const text = localStorage.getItem(LS_KEY);
      if (text) { raw = JSON.parse(text); from = LS_KEY; }
    } catch (e) { /* ignore */ }

    if (!raw) {
      try {
        const text = localStorage.getItem(OLD_KEY);
        if (text) {
          const parsed = JSON.parse(text);
          try { localStorage.setItem(V2_BACKUP_KEY, text); } catch (e) { /* ignore */ }
          if (parsed && parsed.version === 3) { raw = parsed; from = OLD_KEY; }
          else { raw = { __v2: parsed }; from = OLD_KEY; }
        }
      } catch (e) { /* ignore */ }
    }

    if (!raw) return { state: freshState(), migrated: false, from: 'new' };

    let candidate;
    if (raw.__v2) candidate = migrateV2(raw.__v2);
    else if (raw.version === 3) candidate = normalizeV3(raw);
    else candidate = migrateV2(raw);

    const errs = validateState(candidate);
    if (errs.length) {
      console.warn('state validation issues:', errs);
      candidate = normalizeV3(candidate);
    }
    ensureMatch(candidate);
    return { state: candidate, migrated: Boolean(raw.__v2 || raw.version !== 3), from };
  }

  function freshState() {
    const s = emptyState();
    const m = newMatch({ state: s });
    s.matches[m.id] = m;
    s.currentMatchId = m.id;
    return s;
  }

  function ensureMatch(s) {
    if (!Object.keys(s.matches).length) {
      const m = newMatch({ state: s });
      s.matches[m.id] = m;
      s.currentMatchId = m.id;
    }
    if (!s.currentMatchId || !s.matches[s.currentMatchId]) {
      s.currentMatchId = Object.keys(s.matches)[0];
    }
  }

  /* ==========================================================
     保存 / 备份 / 用量
     ========================================================== */
  function snapshot() {
    return JSON.stringify({ roster: state.roster, matches: state.matches, seq: state.seq, currentMatchId: state.currentMatchId });
  }

  function pushUndo() {
    undoStack.push(snapshot());
    if (undoStack.length > 60) undoStack.shift();
  }

  function toast(message, kind = '') {
    while (els.toasts.children.length >= 3) els.toasts.firstElementChild.remove();
    const node = document.createElement('div');
    node.className = `toast ${kind}`.trim();
    node.textContent = message;
    els.toasts.appendChild(node);
    setTimeout(() => { node.classList.add('out'); setTimeout(() => node.remove(), 220); }, 2600);
  }

  function guardEditable() {
    if (!readOnly) return true;
    toast('这是只读预览，点顶部「复制到我的名单」后再编辑', 'err');
    return false;
  }

  function changed(opts) {
    // 正在输入时只落盘、不重建 DOM（否则输入框会失焦，无法连续输入）
    if (opts && opts.skipRender) {
      if (readOnly) return;
      scheduleSave();
      refreshResultLabels();
      return;
    }
    render();
    if (readOnly) { setSaveStatus('ok', '只读预览'); return; }
    scheduleSave();
  }

  function refreshResultLabels() {
    const m = cur();
    if (m) {
      els.ssResult.textContent = resultText(m);
      els.ssResult.className = 'ss-result' + (hasResult(m) ? ' decided' : '');
      els.matchMeta.textContent = `${m.type === 'external' ? '外战' : '内战'} · ${resultText(m)}`;
    }
    $$('.match-card').forEach((card) => {
      const mm = state.matches[card.dataset.mid];
      const el = card.querySelector('.mc-result');
      if (mm && el) {
        el.textContent = resultText(mm);
        el.className = 'mc-result' + (hasResult(mm) ? ' decided' : '');
      }
    });
  }

  function scheduleSave() {
    setSaveStatus('saving', '保存中');
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveTimer = null; persist(); }, SAVE_DELAY);
  }

  function persist() {
    if (readOnly) return;
    state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
      setSaveStatus('ok', '已存本机');
      renderStorageMeter();
    } catch (err) {
      setSaveStatus('error', '存不下');
      toast('浏览器存储已满或不可用，请立刻下载整库备份', 'err');
    }
  }

  function flushSave() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; persist(); }
  }

  function setSaveStatus(kind, label) {
    const cell = els.hudSave.parentElement;
    cell.classList.remove('saving', 'error');
    if (kind === 'saving') cell.classList.add('saving');
    if (kind === 'error') cell.classList.add('error');
    els.hudSave.replaceChildren();
    const dot = document.createElement('i');
    dot.className = 'dot';
    els.hudSave.appendChild(dot);
    els.hudSave.appendChild(document.createTextNode(label));
  }

  function renderStorageMeter() {
    let bytes = 0;
    try { bytes = new TextEncoder().encode(JSON.stringify(state)).length; } catch (e) { /* ignore */ }
    const kb = bytes / 1024;
    const pct = Math.min(100, (bytes / (5 * 1024 * 1024)) * 100);
    els.smFill.style.width = `${Math.max(1, pct)}%`;
    els.smFill.classList.toggle('warn', bytes > 4 * 1024 * 1024);
    els.smText.textContent = `本机已用 ${kb < 1024 ? kb.toFixed(0) + ' KB' : (kb / 1024).toFixed(2) + ' MB'} / 约 5 MB`;
    els.storageMeter.hidden = false;
  }

  function downloadFile(name, content, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function backupPayload() {
    return {
      app: 'football-draft',
      schema: 3,
      exportedAt: new Date().toISOString(),
      state,
    };
  }

  /* ==========================================================
     统计聚合（只从原始事实计算）
     ========================================================== */
  function matchList() {
    return Object.values(state.matches);
  }

  function quarterOf(date) {
    const month = Number(String(date).slice(5, 7));
    if (!month) return 0;
    return Math.ceil(month / 3);
  }

  function periodKeys() {
    const years = new Set();
    const quarters = new Set();
    matchList().forEach((m) => {
      if (!m.date) return;
      const y = m.date.slice(0, 4);
      years.add(y);
      const q = quarterOf(m.date);
      if (q) quarters.add(`${y}-Q${q}`);
    });
    return {
      years: Array.from(years).sort().reverse(),
      quarters: Array.from(quarters).sort().reverse(),
    };
  }

  function fillPeriodSelects() {
    const { years, quarters } = periodKeys();
    const html = ['<option value="history">历史全部</option>'];
    years.forEach((y) => html.push(`<option value="year:${y}">${y} 年度</option>`));
    quarters.forEach((q) => {
      const [y, n] = q.split('-Q');
      html.push(`<option value="quarter:${q}">${y} 年第 ${n} 季度</option>`);
    });
    [els.archivePeriod, els.statsPeriod].forEach((sel) => {
      const prev = sel.value;
      sel.innerHTML = html.join('');
      if (prev && Array.from(sel.options).some((o) => o.value === prev)) sel.value = prev;
    });
  }

  function inScope(m, period, type) {
    if (type !== 'all' && m.type !== type) return false;
    if (period === 'history' || !period || period === 'all') return true;
    if (!m.date) return false;
    if (period.startsWith('year:')) return m.date.slice(0, 4) === period.slice(5);
    if (period.startsWith('quarter:')) {
      const key = period.slice(8);
      const [y, q] = key.split('-Q');
      return m.date.slice(0, 4) === y && quarterOf(m.date) === Number(q);
    }
    return true;
  }

  function scopeMatches(period, type) {
    return matchList().filter((m) => inScope(m, period, type));
  }

  function hasResult(m) {
    if (m.type === 'external') {
      const vals = m.teams.map((t) => m.scores[t.id]).filter((v) => Number.isInteger(v));
      return vals.length > 0 && Number.isInteger(m.opponentScore);
    }
    return m.teams.filter((t) => Number.isInteger(m.scores[t.id])).length >= 2;
  }

  function ourGoals(m) {
    let total = 0;
    let any = false;
    m.teams.forEach((t) => {
      const v = m.scores[t.id];
      if (Number.isInteger(v)) { total += v; any = true; }
    });
    return any ? total : null;
  }

  function winningTeamIds(m) {
    if (!hasResult(m)) return [];
    if (m.type === 'external') {
      const g = ourGoals(m);
      return g !== null && g > m.opponentScore ? m.teams.map((t) => t.id) : [];
    }
    const scored = m.teams.filter((t) => Number.isInteger(m.scores[t.id]));
    if (!scored.length) return [];
    const max = Math.max(...scored.map((t) => m.scores[t.id]));
    const winners = scored.filter((t) => m.scores[t.id] === max);
    return winners.length === 1 ? [winners[0].id] : [];
  }

  function losingTeamIds(m) {
    if (!hasResult(m)) return [];
    if (m.type === 'external') {
      const g = ourGoals(m);
      return g !== null && g < m.opponentScore ? m.teams.map((t) => t.id) : [];
    }
    const winners = winningTeamIds(m);
    if (!winners.length) return [];
    return m.teams.filter((t) => !winners.includes(t.id)).map((t) => t.id);
  }

  function isWin(m, pid) {
    if (!hasResult(m) || !isPresent(m, pid)) return false;
    const t = teamOf(m, pid);
    return t ? winningTeamIds(m).includes(t.id) : false;
  }

  function resultText(m) {
    if (!hasResult(m)) return '结果未录入';
    const w = winningTeamIds(m);
    if (m.type === 'external') {
      const g = ourGoals(m);
      if (g > m.opponentScore) return `本方胜 ${g}:${m.opponentScore}`;
      if (g === m.opponentScore) return `平局 ${g}:${m.opponentScore}`;
      return `本方负 ${g}:${m.opponentScore}`;
    }
    if (!w.length) return '平局（并列最高）';
    const t = m.teams.find((x) => x.id === w[0]);
    return `${(t && t.name) || '胜队'} 获胜`;
  }

  function computeStats(period, type) {
    const M = scopeMatches(period, type);
    const rows = {};
    Object.keys(state.roster).forEach((pid) => {
      rows[pid] = {
        pid, name: rosterName(pid), appeared: 0, valid: 0, wins: 0,
        goals: 0, assists: 0, hatGoals: 0, hatAssists: 0,
        mvp: 0, svp: 0, cleanSheet: 0, active: state.roster[pid].active,
      };
    });

    M.forEach((m) => {
      Object.entries(m.stats).forEach(([pid, st]) => {
        const r = rows[pid];
        if (!r) return;
        if (!isPresent(m, pid)) return;
        r.appeared += 1;
        if (hasResult(m)) r.valid += 1;
        if (isWin(m, pid)) r.wins += 1;
        const g = Number(st.goals) || 0;
        const a = Number(st.assists) || 0;
        r.goals += g;
        r.assists += a;
        if (g >= 3) r.hatGoals += 1;
        if (a >= 3) r.hatAssists += 1;
        if (st.mvp) r.mvp += 1;
        if (st.svp) r.svp += 1;
        if (st.cleanSheet) r.cleanSheet += 1;
      });
    });

    Object.values(rows).forEach((r) => {
      r.attendance = M.length ? r.appeared / M.length : 0;
      r.winRate = r.valid > 0 ? r.wins / r.valid : null;
    });

    return {
      M,
      rows,
      totalMatches: M.length,
      internal: M.filter((m) => m.type === 'internal').length,
      external: M.filter((m) => m.type === 'external').length,
      undatedExcluded: matchList().filter((m) => !m.date && period !== 'history' && period !== 'all').length,
    };
  }

  const BOARDS = [
    { key: 'attendance', label: '出勤率', fmt: (r) => r.M ? pct(r.attendance) : '0%', val: (r) => r.attendance },
    { key: 'winRate', label: '出场胜率', fmt: (r) => r.winRate === null ? '—' : pct(r.winRate), val: (r) => r.winRate, nullable: true },
    { key: 'goals', label: '进球数', fmt: (r) => String(r.goals), val: (r) => r.goals },
    { key: 'assists', label: '助攻数', fmt: (r) => String(r.assists), val: (r) => r.assists },
    { key: 'hatGoals', label: '进球帽子戏法', fmt: (r) => String(r.hatGoals), val: (r) => r.hatGoals },
    { key: 'hatAssists', label: '助攻帽子戏法', fmt: (r) => String(r.hatAssists), val: (r) => r.hatAssists },
    { key: 'mvp', label: 'MVP 次数', fmt: (r) => String(r.mvp), val: (r) => r.mvp },
    { key: 'svp', label: 'SVP 次数', fmt: (r) => String(r.svp), val: (r) => r.svp },
    { key: 'cleanSheet', label: '门将零封次数', fmt: (r) => String(r.cleanSheet), val: (r) => r.cleanSheet },
  ];

  function pct(v) { return `${(v * 100).toFixed(0)}%`; }

  function sortRows(rows, board) {
    const arr = Object.values(rows);
    const ranked = [];
    const unranked = [];
    arr.forEach((r) => {
      const v = board.val(r);
      if (board.nullable && v === null) unranked.push(r);
      else ranked.push({ r, v });
    });
    ranked.sort((a, b) => b.v - a.v || b.r.appeared - a.r.appeared || a.r.name.localeCompare(b.r.name, 'zh'));
    unranked.sort((a, b) => b.appeared - a.appeared || a.name.localeCompare(b.name, 'zh'));
    return [
      ...ranked.map((x) => ({ row: x.r, value: x.v, ranked: true })),
      ...unranked.map((r) => ({ row: r, value: null, ranked: false })),
    ];
  }

  /* ==========================================================
     渲染：总入口
     ========================================================== */
  function render() {
    renderHud();
    renderMatchSwitcher();
    renderMatchInfo();
    renderScoreStrip();
    renderRosterList();
    renderTeams();
    renderPool();
    renderLibrary();
    renderArchive();
    renderStats();
    renderStorageMeter();
  }

  function renderHud() {
    els.hudPlayers.textContent = String(Object.keys(state.roster).length);
    els.hudTeams.textContent = String(matchList().length);
    const m = cur();
    els.hudPool.textContent = String(m ? m.pool.length : 0);
    els.btnUndo.disabled = undoStack.length === 0;
  }

  function setView(view) {
    activeView = view;
    els.views.forEach((v) => { v.hidden = v.id !== `view-${view}`; });
    $$('.app-tab').forEach((b) => {
      const on = b.dataset.view === view;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    if (view === 'matches') renderArchive();
    if (view === 'stats') renderStats();
    if (view === 'roster') renderLibrary();
  }

  /* ==========================================================
     渲染：比赛视图
     ========================================================== */
  function renderMatchSwitcher() {
    const list = matchList().sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id.localeCompare(a.id));
    const prev = els.matchSelect.value;
    els.matchSelect.replaceChildren();
    if (!list.length) {
      const o = document.createElement('option');
      o.value = ''; o.textContent = '（暂无比赛）';
      els.matchSelect.appendChild(o);
    } else {
      list.forEach((m) => {
        const o = document.createElement('option');
        o.value = m.id;
        o.textContent = `${m.date || '未设日期'} · ${m.type === 'external' ? '外战' : '内战'}${m.opponent ? ' vs ' + m.opponent : ''} · ${m.id}`;
        els.matchSelect.appendChild(o);
      });
      els.matchSelect.value = state.currentMatchId && state.matches[state.currentMatchId] ? state.currentMatchId : list[0].id;
    }
    const m = cur();
    els.matchMeta.textContent = m ? `${m.type === 'external' ? '外战' : '内战'} · ${resultText(m)}` : '';
    els.btnDeleteMatch.disabled = !m || matchList().length <= 1 || readOnly;
  }

  function renderMatchInfo() {
    const m = cur();
    if (!m) return;
    if (document.activeElement !== els.matchVenue) els.matchVenue.value = m.venue || '';
    if (document.activeElement !== els.matchKickoff) els.matchKickoff.value = m.kickoff || '';
    if (document.activeElement !== els.matchOpponent) els.matchOpponent.value = m.opponent || '';
    els.matchVenue.disabled = els.matchKickoff.disabled = els.matchOpponent.disabled = readOnly;
  }

  function renderScoreStrip() {
    const m = cur();
    els.ssTeams.replaceChildren();
    if (!m) { els.ssResult.textContent = ''; return; }
    m.teams.forEach((t) => {
      const box = document.createElement('label');
      box.className = 'ss-team';
      box.style.setProperty('--accent', t.color);
      const span = document.createElement('span');
      span.className = 'ss-name';
      span.textContent = t.name;
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0'; input.max = '99';
      input.placeholder = '—';
      input.dataset.scoreTeam = t.id;
      input.setAttribute('aria-label', `${t.name} 进球`);
      input.value = Number.isInteger(m.scores[t.id]) ? String(m.scores[t.id]) : '';
      input.disabled = readOnly;
      box.appendChild(span);
      box.appendChild(input);
      els.ssTeams.appendChild(box);
    });
    if (m.type === 'external') {
      const box = document.createElement('label');
      box.className = 'ss-team ss-opponent';
      const span = document.createElement('span');
      span.className = 'ss-name';
      span.textContent = m.opponent || '对手';
      const input = document.createElement('input');
      input.type = 'number'; input.min = '0'; input.max = '99'; input.placeholder = '—';
      input.dataset.scoreOpponent = '1';
      input.setAttribute('aria-label', '对手进球');
      input.value = Number.isInteger(m.opponentScore) ? String(m.opponentScore) : '';
      input.disabled = readOnly;
      box.appendChild(span);
      box.appendChild(input);
      els.ssTeams.appendChild(box);
    }
    els.ssResult.textContent = resultText(m);
    els.ssResult.className = 'ss-result' + (hasResult(m) ? ' decided' : '');
  }

  function makeChip(pid, index, opts = {}) {
    const name = rosterName(pid);
    const chip = document.createElement(opts.tag || 'div');
    chip.className = 'chip';
    chip.dataset.pid = pid;
    chip.tabIndex = 0;
    chip.setAttribute('role', 'button');
    chip.setAttribute('aria-label', `${name}，可拖拽`);

    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = String(index);
    if (opts.accent) num.style.setProperty('--accent', opts.accent);
    chip.appendChild(num);

    const nm = document.createElement('span');
    nm.className = 'name';
    nm.textContent = name;
    chip.appendChild(nm);

    if (opts.where) {
      const w = document.createElement('span');
      w.className = 'where';
      w.style.background = opts.where.color || 'rgba(207,217,205,.4)';
      w.title = opts.where.label;
      chip.appendChild(w);
    }
    const grip = document.createElement('span');
    grip.className = 'grip';
    grip.textContent = '⠿';
    grip.setAttribute('aria-hidden', 'true');
    chip.appendChild(grip);

    if (!readOnly) {
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'remove';
      rm.textContent = '✕';
      rm.title = opts.removeTitle || '移除';
      rm.setAttribute('aria-label', rm.title);
      rm.dataset.act = opts.removeAct || 'remove';
      chip.appendChild(rm);
    }
    if (pid === selectedId) chip.classList.add('selected');
    if (opts.placed) chip.classList.add('is-placed');
    return chip;
  }

  function renderRosterList() {
    const m = cur();
    const query = (els.search.value || '').trim().toLowerCase();
    const pids = squadPids(m);
    const frag = document.createDocumentFragment();
    let shown = 0;

    pids.forEach((pid, index) => {
      if (query && !rosterName(pid).toLowerCase().includes(query)) return;
      const loc = locate(pid);
      const where = loc && loc.type === 'team'
        ? { color: loc.team.color, label: loc.team.name }
        : { color: 'rgba(207,217,205,.35)', label: '替补席' };
      const chip = makeChip(pid, index + 1, {
        tag: 'li', where,
        placed: loc && loc.type === 'team',
        removeTitle: '从本场名单移除（球员库保留）',
        removeAct: 'remove-squad',
      });
      frag.appendChild(chip);
      shown += 1;
    });

    els.rosterList.replaceChildren();
    if (!pids.length) {
      const li = document.createElement('li');
      li.className = 'roster-empty';
      li.textContent = '本场还没有报名球员';
      els.rosterList.appendChild(li);
    } else if (!shown) {
      const li = document.createElement('li');
      li.className = 'roster-empty';
      li.textContent = '没有匹配的球员';
      els.rosterList.appendChild(li);
    } else {
      els.rosterList.appendChild(frag);
    }
    els.rosterCount.textContent = `${pids.length} 人`;
  }

  function locate(pid) {
    const m = cur();
    if (!m) return null;
    if (m.pool.includes(pid)) return { type: 'pool' };
    const t = m.teams.find((x) => x.players.includes(pid));
    return t ? { type: 'team', team: t } : null;
  }

  function renderTeams() {
    const m = cur();
    const hasPlayers = m && squadPids(m).length > 0;
    els.boardEmpty.hidden = hasPlayers;
    els.teams.hidden = !hasPlayers;
    els.teamCount.value = String(m ? m.teams.length : MIN_TEAMS);
    els.boardSub.textContent = `${m ? m.teams.length : 0} 支球队 · ${m ? squadPids(m).length : 0} 名球员`;
    els.teamCount.disabled = readOnly;

    const frag = document.createDocumentFragment();
    if (!m) { els.teams.replaceChildren(frag); return; }

    m.teams.forEach((team) => {
      const card = document.createElement('article');
      card.className = 'team dropzone';
      card.dataset.zone = team.id;
      card.style.setProperty('--accent', team.color);

      const head = document.createElement('header');
      head.className = 'team-head';

      const kit = document.createElement('span');
      kit.className = 'kit';
      kit.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 3 5 4.9 2.6 9.3l3.2 1.8 1-1.9V21h10.4V9.2l1 1.9 3.2-1.8L19 4.9 15.4 3a3.4 3.4 0 0 1-6.8 0Z" fill="currentColor"/></svg>';
      const wrap = document.createElement('label');
      wrap.className = 'kit-picker';
      wrap.title = readOnly ? team.name : '点击更换球队颜色';
      const ci = document.createElement('input');
      ci.type = 'color';
      ci.className = 'kit-color';
      ci.value = team.color;
      ci.dataset.team = team.id;
      ci.setAttribute('aria-label', `${team.name} 的球队颜色`);
      if (readOnly) ci.disabled = true;
      wrap.appendChild(kit);
      wrap.appendChild(ci);
      head.appendChild(wrap);

      const ni = document.createElement('input');
      ni.className = 'team-name';
      ni.value = team.name;
      ni.maxLength = 16;
      ni.readOnly = readOnly;
      ni.setAttribute('aria-label', '球队名称');
      ni.dataset.team = team.id;
      head.appendChild(ni);

      const cnt = document.createElement('span');
      cnt.className = 'team-count';
      cnt.textContent = `${team.players.length} 人`;
      head.appendChild(cnt);

      if (!readOnly) {
        const rb = document.createElement('button');
        rb.type = 'button';
        rb.className = 'team-remove';
        rb.textContent = '✕';
        rb.title = '移除球队，球员回到替补席';
        rb.setAttribute('aria-label', rb.title);
        rb.dataset.act = 'remove-team';
        rb.dataset.team = team.id;
        head.appendChild(rb);
      }
      card.appendChild(head);

      const body = document.createElement('div');
      body.className = 'team-body';
      if (!team.players.length) {
        const slot = document.createElement('div');
        slot.className = 'slot-empty';
        slot.textContent = '拖到这里';
        body.appendChild(slot);
      } else {
        team.players.forEach((pid, i) => {
          const st = m.stats[pid];
          const badge = st ? buildBadges(st) : '';
          const chip = makeChip(pid, i + 1, {
            accent: team.color,
            removeTitle: '移回替补席',
            removeAct: 'to-pool',
          });
          if (badge) {
            const b = document.createElement('span');
            b.className = 'chip-badges';
            b.textContent = badge;
            chip.appendChild(b);
          }
          body.appendChild(chip);
        });
      }
      card.appendChild(body);
      frag.appendChild(card);
    });
    els.teams.replaceChildren(frag);
  }

  function buildBadges(st) {
    const parts = [];
    if ((st.goals || 0) >= 3) parts.push('⚽帽');
    if ((st.assists || 0) >= 3) parts.push('🅰帽');
    if (st.mvp) parts.push('MVP');
    if (st.svp) parts.push('SVP');
    if (st.cleanSheet) parts.push('零封');
    if ((st.goals || 0) > 0) parts.push(`${st.goals}球`);
    if ((st.assists || 0) > 0) parts.push(`${st.assists}助`);
    return parts.join(' ');
  }

  function renderPool() {
    const m = cur();
    const frag = document.createDocumentFragment();
    if (!m || !m.pool.length) {
      const s = document.createElement('span');
      s.className = 'tray-empty';
      s.textContent = m && squadPids(m).length ? '全部球员都已就位，准备开球！' : '这里会显示还没有被分队的球员';
      frag.appendChild(s);
    } else {
      m.pool.forEach((pid, i) => {
        const chip = makeChip(pid, i + 1, { removeTitle: '从本场名单移除', removeAct: 'remove-squad' });
        frag.appendChild(chip);
      });
    }
    els.pool.replaceChildren(frag);
    els.trayCount.textContent = String(m ? m.pool.length : 0);
  }

  /* ==========================================================
     渲染：球员库
     ========================================================== */
  function renderLibrary() {
    const q = (els.libSearch.value || '').trim().toLowerCase();
    const pids = Object.keys(state.roster).sort((a, b) => {
      const A = state.roster[a], B = state.roster[b];
      if (A.active !== B.active) return A.active ? -1 : 1;
      return A.name.localeCompare(B.name, 'zh');
    });
    const all = computeStats('history', 'all');

    const active = pids.filter((p) => state.roster[p].active).length;
    const registered = new Set(squadPids(cur()));
    els.librarySummary.textContent = `共 ${pids.length} 名球员 · 在用 ${active} 名 · 停用 ${pids.length - active} 名 · 本场已报名 ${registered.size} 名`;

    const frag = document.createDocumentFragment();
    let shown = 0;
    pids.forEach((pid) => {
      const p = state.roster[pid];
      const hay = `${p.name} ${p.number} ${p.note}`.toLowerCase();
      if (q && !hay.includes(q)) return;
      shown += 1;
      const tr = document.createElement('tr');
      if (!p.active) tr.className = 'inactive';
      tr.dataset.pid = pid;

      const tdCheck = document.createElement('td');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'lib-check';
      cb.dataset.pid = pid;
      cb.checked = libChecked.has(pid);
      cb.setAttribute('aria-label', `勾选 ${p.name}`);
      tdCheck.appendChild(cb);
      tr.appendChild(tdCheck);

      const tdName = document.createElement('td');
      tdName.className = 'td-name';
      tdName.textContent = p.name;
      if (registered.has(pid)) {
        const tag = document.createElement('span');
        tag.className = 'mini-tag';
        tag.textContent = '本场';
        tdName.appendChild(tag);
      }
      tr.appendChild(tdName);

      const cells = [p.number || '—', p.position || '—', p.joinedAt || '—'];
      cells.forEach((v) => {
        const td = document.createElement('td');
        td.textContent = v;
        tr.appendChild(td);
      });

      const tdApp = document.createElement('td');
      tdApp.className = 'col-num';
      tdApp.textContent = String(all.rows[pid] ? all.rows[pid].appeared : 0);
      tr.appendChild(tdApp);

      const tdNote = document.createElement('td');
      tdNote.className = 'td-note';
      tdNote.textContent = p.note || '';
      tr.appendChild(tdNote);

      const tdOps = document.createElement('td');
      tdOps.className = 'col-ops';
      tdOps.appendChild(opBtn('编辑', 'edit-player', pid));
      tdOps.appendChild(opBtn(p.active ? '停用' : '启用', 'toggle-player', pid));
      tdOps.appendChild(opBtn('合并', 'merge-player', pid));
      tr.appendChild(tdOps);

      frag.appendChild(tr);
    });
    els.libraryBody.replaceChildren();
    if (!shown) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 8;
      td.className = 'table-empty';
      td.textContent = pids.length ? '没有匹配的球员' : '球员库还是空的，点「新增球员」或「批量导入」开始';
      tr.appendChild(td);
      els.libraryBody.appendChild(tr);
    } else {
      els.libraryBody.appendChild(frag);
    }
    updateLibSelected();
  }

  function opBtn(label, act, pid) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tiny-btn';
    b.textContent = label;
    b.dataset.act = act;
    b.dataset.pid = pid;
    return b;
  }

  function updateLibSelected() {
    els.libSelected.textContent = `已勾选 ${libChecked.size} 人`;
  }

  /* ==========================================================
     渲染：比赛档案
     ========================================================== */
  function renderArchive() {
    const period = els.archivePeriod.value || 'history';
    const type = els.archiveType.value || 'all';
    const list = scopeMatches(period, type).sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id.localeCompare(a.id));
    const all = matchList();
    els.archiveSummary.textContent = `共 ${all.length} 场比赛 · 当前筛选 ${list.length} 场（内战 ${list.filter((m) => m.type === 'internal').length} / 外战 ${list.filter((m) => m.type === 'external').length}）`;

    const frag = document.createDocumentFragment();
    if (!list.length) {
      const d = document.createElement('div');
      d.className = 'archive-empty';
      d.textContent = '这个筛选下还没有比赛';
      frag.appendChild(d);
    }

    list.forEach((m) => {
      const card = document.createElement('article');
      card.className = 'match-card' + (m.id === state.currentMatchId ? ' is-current' : '');
      card.dataset.mid = m.id;

      const head = document.createElement('header');
      head.className = 'mc-head';
      const left = document.createElement('div');
      left.className = 'mc-title';
      left.innerHTML = `<strong>${escapeHtml(m.date || '未设日期')}</strong>` +
        `<span class="mc-badge ${m.type === 'external' ? 'ext' : 'int'}">${m.type === 'external' ? '外战' : '内战'}</span>`;
      if (m.opponent) {
        const sp = document.createElement('span');
        sp.className = 'mc-opponent';
        sp.textContent = `vs ${m.opponent}`;
        left.appendChild(sp);
      }
      if (m.id === state.currentMatchId) {
        const sp = document.createElement('span');
        sp.className = 'mc-badge cur';
        sp.textContent = '当前';
        left.appendChild(sp);
      }
      head.appendChild(left);

      const ops = document.createElement('div');
      ops.className = 'mc-ops';
      ops.appendChild(mcBtn('打开本场', 'open-match'));
      ops.appendChild(mcBtn('设置', 'edit-match'));
      ops.appendChild(mcBtn('名单 TXT', 'export-match'));
      ops.appendChild(mcBtn('删除', 'delete-match', true));
      head.appendChild(ops);
      card.appendChild(head);

      const meta = document.createElement('div');
      meta.className = 'mc-meta';
      meta.textContent = [m.venue, m.kickoff ? formatKickoff(m.kickoff) : '', m.note].filter(Boolean).join(' · ') || '未填写比赛信息';
      card.appendChild(meta);

      const scores = document.createElement('div');
      scores.className = 'mc-scores';
      m.teams.forEach((t, i) => {
        if (i > 0) {
          const sep = document.createElement('span');
          sep.className = 'mc-vs';
          sep.textContent = ':';
          scores.appendChild(sep);
        }
        const lab = document.createElement('label');
        lab.className = 'mc-score';
        lab.style.setProperty('--accent', t.color);
        const nm = document.createElement('span');
        nm.textContent = t.name;
        const inp = document.createElement('input');
        inp.type = 'number'; inp.min = '0'; inp.max = '99'; inp.placeholder = '—';
        inp.dataset.scoreTeam = t.id;
        inp.value = Number.isInteger(m.scores[t.id]) ? String(m.scores[t.id]) : '';
        inp.disabled = readOnly;
        lab.appendChild(nm);
        lab.appendChild(inp);
        scores.appendChild(lab);
      });
      if (m.type === 'external') {
        const sep = document.createElement('span');
        sep.className = 'mc-vs';
        sep.textContent = ':';
        scores.appendChild(sep);
        const lab = document.createElement('label');
        lab.className = 'mc-score mc-opp';
        const nm = document.createElement('span');
        nm.textContent = m.opponent || '对手';
        const inp = document.createElement('input');
        inp.type = 'number'; inp.min = '0'; inp.max = '99'; inp.placeholder = '—';
        inp.dataset.scoreOpponent = '1';
        inp.value = Number.isInteger(m.opponentScore) ? String(m.opponentScore) : '';
        inp.disabled = readOnly;
        lab.appendChild(nm);
        lab.appendChild(inp);
        scores.appendChild(lab);
      }
      const res = document.createElement('span');
      res.className = 'mc-result' + (hasResult(m) ? ' decided' : '');
      res.textContent = resultText(m);
      scores.appendChild(res);
      card.appendChild(scores);

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'mc-toggle';
      toggle.dataset.act = 'toggle-stats';
      const open = expandedCards.has(m.id);
      toggle.textContent = open ? '▾ 收起逐人数据' : `▸ 展开逐人数据（${squadPids(m).length} 人）`;
      card.appendChild(toggle);

      if (open) card.appendChild(buildStatsTable(m));
      frag.appendChild(card);
    });
    els.matchCards.replaceChildren(frag);
  }

  function mcBtn(label, act, danger = false) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tiny-btn' + (danger ? ' danger' : '');
    b.textContent = label;
    b.dataset.act = act;
    return b;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function formatKickoff(v) {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function buildStatsTable(m) {
    const box = document.createElement('div');
    box.className = 'mc-stats';

    const winners = winningTeamIds(m);
    const losers = losingTeamIds(m);
    const hint = document.createElement('p');
    hint.className = 'mc-hint';
    if (!hasResult(m)) {
      hint.textContent = '结果未录入：可照常填进球/助攻/到场，但 MVP、SVP 不开放自动判定。帽子戏法由进球/助攻 ≥3 自动识别。';
    } else if (!winners.length) {
      hint.textContent = '平局：无明确胜/负队，MVP 与 SVP 不自动开放（可手动标记，界面会给出提示）。';
    } else {
      const wt = m.teams.filter((t) => winners.includes(t.id)).map((t) => t.name).join('、');
      const lt = m.teams.filter((t) => losers.includes(t.id)).map((t) => t.name).join('、');
      hint.textContent = `胜队：${wt || '—'}（MVP 候选） · 输队：${lt || '—'}（SVP 候选）。全场各限 1 人。`;
    }
    box.appendChild(hint);

    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    const table = document.createElement('table');
    table.className = 'data-table stats-table';
    table.innerHTML = '<thead><tr><th>到场</th><th>球员</th><th>球队</th><th>进球</th><th>助攻</th><th>零封</th><th>MVP</th><th>SVP</th><th>标记</th></tr></thead>';
    const tbody = document.createElement('tbody');

    squadPids(m).forEach((pid) => {
      const st = m.stats[pid];
      const t = teamOf(m, pid);
      const tr = document.createElement('tr');
      tr.dataset.pid = pid;
      if (st.present === false) tr.className = 'absent';

      const tdPresent = document.createElement('td');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = st.present !== false;
      cb.dataset.statPresent = pid;
      cb.setAttribute('aria-label', `${rosterName(pid)} 到场`);
      cb.disabled = readOnly;
      tdPresent.appendChild(cb);
      tr.appendChild(tdPresent);

      const tdName = document.createElement('td');
      tdName.className = 'td-name';
      tdName.textContent = rosterName(pid);
      tr.appendChild(tdName);

      const tdTeam = document.createElement('td');
      tdTeam.textContent = t ? t.name : '替补席';
      if (t) tdTeam.style.color = t.color;
      tr.appendChild(tdTeam);

      [['goals', pid], ['assists', pid]].forEach(([field]) => {
        const td = document.createElement('td');
        const inp = document.createElement('input');
        inp.type = 'number'; inp.min = '0'; inp.max = '99';
        inp.className = 'stat-num';
        inp.value = String(st[field] || 0);
        inp.dataset.statNum = field;
        inp.dataset.pid = pid;
        inp.disabled = readOnly || st.present === false;
        td.appendChild(inp);
        tr.appendChild(td);
      });

      const tdCs = document.createElement('td');
      const csb = document.createElement('input');
      csb.type = 'checkbox';
      csb.checked = Boolean(st.cleanSheet);
      csb.dataset.statBool = 'cleanSheet';
      csb.dataset.pid = pid;
      csb.disabled = readOnly || st.present === false;
      csb.setAttribute('aria-label', '门将零封');
      tdCs.appendChild(csb);
      tr.appendChild(tdCs);

      ['mvp', 'svp'].forEach((award) => {
        const td = document.createElement('td');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'award-btn' + (st[award] ? ' on' : '');
        b.textContent = st[award] ? '★' : '☆';
        b.dataset.act = 'award';
        b.dataset.award = award;
        b.dataset.pid = pid;
        b.disabled = readOnly || st.present === false;
        b.title = award === 'mvp' ? 'MVP（胜队最佳）' : 'SVP（输队最佳）';
        td.appendChild(b);
        tr.appendChild(td);
      });

      const tdBadge = document.createElement('td');
      tdBadge.className = 'td-badges';
      tdBadge.textContent = buildBadges(st) || '—';
      tr.appendChild(tdBadge);

      tbody.appendChild(tr);
    });

    if (!squadPids(m).length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 9;
      td.className = 'table-empty';
      td.textContent = '本场没有报名球员';
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    box.appendChild(wrap);

    const totals = document.createElement('p');
    totals.className = 'mc-totals';
    const sumG = squadPids(m).reduce((n, p) => n + (m.stats[p].goals || 0), 0);
    const sumA = squadPids(m).reduce((n, p) => n + (m.stats[p].assists || 0), 0);
    totals.textContent = `逐人合计：进球 ${sumG} · 助攻 ${sumA}（不强制等于球队比分，仅提示差异）`;
    box.appendChild(totals);
    return box;
  }

  /* ==========================================================
     渲染：统计 / 排行榜
     ========================================================== */
  function renderStats() {
    const period = els.statsPeriod.value || 'history';
    const type = els.statsType.value || 'all';
    const data = computeStats(period, type);

    const notes = [];
    if (!data.M.length) notes.push('当前筛选下没有比赛，统计为空。');
    if (data.undatedExcluded) notes.push(`有 ${data.undatedExcluded} 场未设日期的比赛未纳入此时段统计（历史全部口径下会计入）。`);
    notes.push('胜率分母 = 有明确赛果的参加场次；未录结果的比赛仍计入出勤率与参加次数。帽子戏法由进球/助攻 ≥3 自动推导。');
    els.statsNote.textContent = notes.join('  ');

    // 概览
    const rows = Object.values(data.rows).sort((a, b) => b.appeared - a.appeared || b.wins - a.wins || a.name.localeCompare(b.name, 'zh'));
    const totalAppear = rows.reduce((n, r) => n + r.appeared, 0);
    const totalWins = rows.reduce((n, r) => n + r.wins, 0);

    els.overviewCards.replaceChildren();
    els.overviewCards.appendChild(overviewCard('球队组织总次数', String(data.totalMatches),
      `内战 ${data.internal} 场 · 外战 ${data.external} 场`, 'lime'));
    els.overviewCards.appendChild(overviewCard('球员参加总人次', String(totalAppear),
      `本口径共 ${data.totalMatches} 场比赛`, 'cyan', miniRank(rows, 'appeared', '参加')));
    els.overviewCards.appendChild(overviewCard('胜场总人次', String(totalWins),
      '按「获胜队到场球员」逐场累加', 'amber', miniRank(rows, 'wins', '胜场')));

    // 榜单
    const frag = document.createDocumentFragment();
    BOARDS.forEach((board) => {
      const sorted = sortRows(data.rows, board);
      const card = document.createElement('section');
      card.className = 'lb-card';
      const h = document.createElement('h3');
      h.textContent = board.label;
      card.appendChild(h);
      const table = document.createElement('table');
      table.className = 'lb-table';
      table.innerHTML = '<thead><tr><th>#</th><th>球员</th><th>数值</th><th>参加</th><th>有效</th><th>胜</th></tr></thead>';
      const tbody = document.createElement('tbody');
      sorted.forEach((item, i) => {
        const r = item.row;
        const tr = document.createElement('tr');
        if (i === 0 && item.ranked && item.value > 0) tr.className = 'top1';
        const cells = [
          item.ranked ? String(i + 1) : '—',
          r.name + (r.active ? '' : '（停用）'),
          board.nullable ? (item.value === null ? '—' : pct(item.value)) : item.value === null ? '—' : board.fmt(r),
          String(r.appeared), String(r.valid), String(r.wins),
        ];
        cells.forEach((v, ci) => {
          const td = document.createElement('td');
          td.textContent = v;
          if (ci === 2) td.className = 'lb-value';
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      card.appendChild(table);
      frag.appendChild(card);
    });
    els.leaderboards.replaceChildren(frag);
  }

  function overviewCard(title, value, sub, tone, mini) {
    const d = document.createElement('article');
    d.className = `ov-card tone-${tone}`;
    const h = document.createElement('h3');
    h.textContent = title;
    const v = document.createElement('strong');
    v.textContent = value;
    const s = document.createElement('span');
    s.textContent = sub;
    d.appendChild(h); d.appendChild(v); d.appendChild(s);
    if (mini) d.appendChild(mini);
    return d;
  }

  function miniRank(rows, key, label) {
    const box = document.createElement('div');
    box.className = 'mini-rank';
    rows.filter((r) => r[key] > 0).slice(0, 8).forEach((r, i) => {
      const line = document.createElement('div');
      line.innerHTML = `<span>${i + 1}. ${escapeHtml(r.name)}</span><strong>${r[key]}</strong>`;
      box.appendChild(line);
    });
    if (!box.children.length) {
      const line = document.createElement('div');
      line.textContent = `暂无${label}记录`;
      box.appendChild(line);
    }
    return box;
  }

  /* ==========================================================
     CSV / 文本导出
     ========================================================== */
  function csvCell(v) {
    const s = String(v === null || v === undefined ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function statsCsv() {
    const period = els.statsPeriod.value || 'history';
    const type = els.statsType.value || 'all';
    const data = computeStats(period, type);
    const head = ['球员', '出勤率', '出场胜率', '参加', '有效', '胜场', '进球', '助攻', '进球帽子戏法', '助攻帽子戏法', 'MVP', 'SVP', '零封', '状态'];
    const lines = [head.join(',')];
    Object.values(data.rows)
      .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, 'zh'))
      .forEach((r) => {
        lines.push([
          r.name, pct(r.attendance), r.winRate === null ? '' : pct(r.winRate),
          r.appeared, r.valid, r.wins, r.goals, r.assists,
          r.hatGoals, r.hatAssists, r.mvp, r.svp, r.cleanSheet,
          r.active ? '在用' : '停用',
        ].map(csvCell).join(','));
      });
    return '\uFEFF' + lines.join('\r\n');
  }

  function matchesCsv() {
    const head = ['比赛ID', '日期', '类型', '对手', '场地', '球员', '球队', '到场', '进球', '助攻', '帽子(进)', '帽子(助)', 'MVP', 'SVP', '零封', '是否获胜'];
    const lines = [head.join(',')];
    matchList().sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach((m) => {
      squadPids(m).forEach((pid) => {
        const st = m.stats[pid];
        const t = teamOf(m, pid);
        lines.push([
          m.id, m.date, m.type === 'external' ? '外战' : '内战', m.opponent, m.venue,
          rosterName(pid), t ? t.name : '替补席', st.present === false ? '否' : '是',
          st.goals || 0, st.assists || 0,
          (st.goals || 0) >= 3 ? 1 : 0, (st.assists || 0) >= 3 ? 1 : 0,
          st.mvp ? 1 : 0, st.svp ? 1 : 0, st.cleanSheet ? 1 : 0,
          isWin(m, pid) ? 1 : 0,
        ].map(csvCell).join(','));
      });
    });
    return '\uFEFF' + lines.join('\r\n');
  }

  function matchText(m) {
    const lines = [];
    lines.push('FOOTBALL DRAFT · 单场名单');
    if (m.date) lines.push(`日期：${m.date}`);
    lines.push(`类型：${m.type === 'external' ? '外战' : '内战'}`);
    if (m.opponent) lines.push(`对手：${m.opponent}`);
    if (m.venue) lines.push(`场地：${m.venue}`);
    if (m.kickoff) lines.push(`开球：${formatKickoff(m.kickoff)}`);
    lines.push(`比分：${m.teams.map((t) => `${t.name} ${Number.isInteger(m.scores[t.id]) ? m.scores[t.id] : '—'}`).join(' : ')}` +
      (m.type === 'external' ? ` : ${m.opponent || '对手'} ${Number.isInteger(m.opponentScore) ? m.opponentScore : '—'}` : ''));
    lines.push(`赛果：${resultText(m)}`);
    lines.push('');
    m.teams.forEach((t) => {
      lines.push(`【${t.name}】 ${t.players.length} 人`);
      t.players.forEach((pid, i) => lines.push(`  ${i + 1}. ${rosterName(pid)}${buildBadges(m.stats[pid]) ? ' · ' + buildBadges(m.stats[pid]) : ''}`));
      lines.push('');
    });
    lines.push(`【替补席】 ${m.pool.length} 人`);
    m.pool.forEach((pid, i) => lines.push(`  ${i + 1}. ${rosterName(pid)}`));
    return lines.join('\n');
  }

  /* ==========================================================
     分享（单场只读预览）
     ========================================================== */
  function b64encode(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64decode(text) {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(padded + '==='.slice((padded.length + 3) % 4));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }

  function sharePayload() {
    const m = cur();
    if (!m) return null;
    const pids = squadPids(m);
    return {
      v: 3,
      roster: pids.map((pid) => ({ ...state.roster[pid] })),
      match: JSON.parse(JSON.stringify(m)),
    };
  }

  function readShared() {
    const raw = location.hash.replace(/^#/, '');
    if (!raw) return null;
    const match = /(?:^|&)d=([A-Za-z0-9_-]+)/.exec(raw);
    if (!match) return null;
    try {
      const data = JSON.parse(b64decode(match[1]));
      if (!data || data.v !== 3 || !data.match) return null;
      return data;
    } catch (e) { return null; }
  }

  function openShare() {
    if (!cur() || !squadPids(cur()).length) { toast('本场还没有报名球员，没什么可分享的', 'err'); return; }
    const url = new URL(location.href);
    url.search = '';
    url.hash = `d=${b64encode(JSON.stringify(sharePayload()))}`;
    els.shareUrl.value = url.toString();
    const long = url.toString().length > 8000;
    els.shareMeta.textContent = long
      ? `链接较长（${url.toString().length} 字符），部分聊天软件可能截断，建议改用备份文件。`
      : `链接长度 ${url.toString().length} 字符，直接发给队友即可。`;
    els.shareMeta.classList.toggle('warn', long);
    els.dialogShare.showModal();
    setTimeout(() => { els.shareUrl.focus(); els.shareUrl.select(); }, 30);
  }

  function enterReadOnly(data) {
    // 预览会临时替换 state，先把本地真实状态存起来，
    // 供「复制到我的名单」合并 / 「关闭预览」还原
    if (!readOnly) localStateBeforePreview = state;
    const s = freshState();
    (data.roster || []).slice(0, MAX_PLAYERS).forEach((p) => {
      if (!p || !p.id || !p.name) return;
      s.roster[p.id] = {
        id: p.id, name: str(p.name, 24), number: str(p.number, 5),
        position: ['GK', 'DF', 'MF', 'FW'].includes(p.position) ? p.position : '',
        joinedAt: '', active: true, note: str(p.note, 100),
      };
    });
    s.seq.match = 1;
    const raw = data.match;
    const m = {
      id: 'm1',
      date: DATE_RE.test(String(raw.date || '')) ? String(raw.date).slice(0, 10) : '',
      type: raw.type === 'external' ? 'external' : 'internal',
      venue: str(raw.venue, 40), kickoff: str(raw.kickoff, 32),
      opponent: str(raw.opponent, 40), note: str(raw.note, 100),
      teams: [], pool: [], scores: {}, opponentScore: null, stats: {},
    };
    (Array.isArray(raw.teams) ? raw.teams : []).slice(0, MAX_TEAMS).forEach((t, i) => {
      if (!t) return;
      m.teams.push({ id: String(t.id), name: str(t.name, 16) || `球队${i + 1}`, color: normalizeColor(t.color, COLORS[i % COLORS.length]), players: [] });
    });
    if (!m.teams.length) for (let i = 0; i < MIN_TEAMS; i += 1) m.teams.push(makeTeam(m.teams, s));
    const used = new Set();
    m.teams.forEach((t, i) => {
      (Array.isArray(raw.teams[i] && raw.teams[i].players) ? raw.teams[i].players : []).forEach((pid) => {
        if (s.roster[pid] && !used.has(pid)) { used.add(pid); t.players.push(pid); }
      });
    });
    (Array.isArray(raw.pool) ? raw.pool : []).forEach((pid) => {
      if (s.roster[pid] && !used.has(pid)) { used.add(pid); m.pool.push(pid); }
    });
    const rs = raw.scores && typeof raw.scores === 'object' ? raw.scores : {};
    m.teams.forEach((t) => { const v = intOrNull(rs[t.id]); if (v !== null) m.scores[t.id] = v; });
    m.opponentScore = intOrNull(raw.opponentScore);
    used.forEach((pid) => {
      const st = raw.stats && raw.stats[pid];
      m.stats[pid] = {
        present: !st || st.present !== false,
        goals: intOrNull(st && st.goals) || 0,
        assists: intOrNull(st && st.assists) || 0,
        mvp: Boolean(st && st.mvp), svp: Boolean(st && st.svp),
        cleanSheet: Boolean(st && st.cleanSheet),
      };
    });
    s.matches.m1 = m;
    s.currentMatchId = 'm1';
    state = s;
    readOnly = true;
    document.body.classList.add('is-readonly');
    els.viewbar.hidden = false;
  }

  function adoptShared(data) {
    if (!data) return;
    // 关键：预览期间 state 被临时替换过，先恢复本地真实状态再合并
    if (localStateBeforePreview) {
      state = localStateBeforePreview;
      localStateBeforePreview = null;
    }
    // 把分享的球员并入本地球员库（按姓名复用现有 id）
    const byName = new Map(Object.values(state.roster).map((p) => [p.name.toLowerCase(), p.id]));
    const remap = {};
    (data.roster || []).forEach((p) => {
      if (!p || !p.name) return;
      const key = str(p.name, 24).toLowerCase();
      if (byName.has(key)) { remap[p.id] = byName.get(key); return; }
      state.seq.player += 1;
      const pid = `pl${state.seq.player}`;
      state.roster[pid] = {
        id: pid, name: str(p.name, 24), number: str(p.number, 5),
        position: ['GK', 'DF', 'MF', 'FW'].includes(p.position) ? p.position : '',
        joinedAt: str(p.joinedAt, 10), active: true, note: str(p.note, 100),
      };
      byName.set(key, pid);
      remap[p.id] = pid;
    });

    const raw = data.match;
    const m = newMatch({ state });
    m.date = DATE_RE.test(String(raw.date || '')) ? String(raw.date).slice(0, 10) : today();
    m.type = raw.type === 'external' ? 'external' : 'internal';
    m.venue = str(raw.venue, 40); m.kickoff = str(raw.kickoff, 32);
    m.opponent = str(raw.opponent, 40); m.note = str(raw.note, 100);

    const convert = (pid) => remap[pid] || null;
    m.teams = (Array.isArray(raw.teams) ? raw.teams : []).slice(0, MAX_TEAMS).map((t, i) => ({
      id: t && ID_RE.test(String(t.id || '')) ? String(t.id) : `t${i + 1}`,
      name: str(t && t.name, 16) || `球队${i + 1}`,
      color: normalizeColor(t && t.color, COLORS[i % COLORS.length]),
      players: (Array.isArray(t && t.players) ? t.players : []).map(convert).filter(Boolean),
    }));
    if (!m.teams.length) for (let i = 0; i < MIN_TEAMS; i += 1) m.teams.push(makeTeam(m.teams, state));
    m.pool = (Array.isArray(raw.pool) ? raw.pool : []).map(convert).filter(Boolean);

    const rs = raw.scores && typeof raw.scores === 'object' ? raw.scores : {};
    m.teams.forEach((t) => { const v = intOrNull(rs[t.id]); if (v !== null) m.scores[t.id] = v; });
    m.opponentScore = intOrNull(raw.opponentScore);
    const used = new Set();
    [...m.teams.flatMap((t) => t.players), ...m.pool].forEach((pid) => {
      if (used.has(pid)) return;
      used.add(pid);
      m.stats[pid] = defaultStats();
    });
    // 正向遍历分享记录：同名合并时把多条记录累加到同一个本地球员
    const rawStats = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
    Object.entries(rawStats).forEach(([srcPid, st]) => {
      const pid = remap[srcPid];
      if (!pid || !m.stats[pid] || !st) return;
      const target = m.stats[pid];
      target.present = target.present || st.present !== false;
      target.goals += intOrNull(st.goals) || 0;
      target.assists += intOrNull(st.assists) || 0;
      target.mvp = target.mvp || Boolean(st.mvp);
      target.svp = target.svp || Boolean(st.svp);
      target.cleanSheet = target.cleanSheet || Boolean(st.cleanSheet);
    });
    // 全场 MVP / SVP 各至多 1 个（多个分享记录合并后可能超限）
    ['mvp', 'svp'].forEach((award) => {
      const winners = Object.keys(m.stats).filter((pid) => m.stats[pid][award]);
      winners.slice(1).forEach((pid) => { m.stats[pid][award] = false; });
    });

    state.matches[m.id] = m;
    state.currentMatchId = m.id;
    readOnly = false;
    document.body.classList.remove('is-readonly');
    els.viewbar.hidden = true;
    clearHash();
    selectedId = null;
    undoStack = [];
    persist();
    render();
    setSaveStatus('ok', '已复制到本机');
    toast('已复制到你的球员库与比赛档案');
  }

  function clearHash() {
    if (!location.hash) return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
  }

  /* ==========================================================
     对话框
     ========================================================== */
  function confirmDialog(title, text, okLabel = '确定') {
    return new Promise((resolve) => {
      els.confirmTitle.textContent = title;
      els.confirmText.textContent = text;
      els.confirmOk.textContent = okLabel;
      const finish = (value) => {
        els.confirmOk.removeEventListener('click', onOk);
        els.dialogConfirm.removeEventListener('close', onClose);
        els.dialogConfirm.removeEventListener('cancel', onCancel);
        if (els.dialogConfirm.open) els.dialogConfirm.close();
        resolve(value);
      };
      const onOk = () => finish(true);
      const onClose = () => finish(false);
      const onCancel = (e) => { e.preventDefault(); finish(false); };
      els.confirmOk.addEventListener('click', onOk);
      els.dialogConfirm.addEventListener('close', onClose);
      els.dialogConfirm.addEventListener('cancel', onCancel);
      els.dialogConfirm.showModal();
    });
  }

  function openBatch(mode) {
    batchMode = mode;
    els.batchTitle.textContent = mode === 'library' ? '批量导入球员库' : '批量粘贴报名球员';
    els.batchText.value = '';
    els.dialogBatch.showModal();
    setTimeout(() => els.batchText.focus(), 30);
  }

  function applyBatch() {
    const names = els.batchText.value.split(/[\n\r,，、;；\t]+/).map((s) => s.trim()).filter(Boolean);
    els.dialogBatch.close();
    if (!names.length) { toast('没有识别到姓名', 'err'); return; }
    if (!guardEditable()) return;
    pushUndo();
    let addedToLib = 0;
    let addedToSquad = 0;
    const byName = new Map(Object.values(state.roster).map((p) => [p.name.toLowerCase(), p.id]));
    const m = cur();

    names.forEach((raw) => {
      const name = raw.slice(0, 24);
      if (!name) return;
      const key = name.toLowerCase();
      let pid = byName.get(key);
      if (!pid) {
        if (Object.keys(state.roster).length >= MAX_PLAYERS) return;
        state.seq.player += 1;
        pid = `pl${state.seq.player}`;
        state.roster[pid] = { id: pid, name, number: '', position: '', joinedAt: today(), active: true, note: '' };
        byName.set(key, pid);
        addedToLib += 1;
      }
      if (batchMode === 'squad' && m && !m.stats[pid]) {
        m.pool.push(pid);
        m.stats[pid] = defaultStats();
        addedToSquad += 1;
      }
    });
    changed();
    toast(batchMode === 'library'
      ? `已向球员库导入 ${addedToLib} 名新球员`
      : `新入库 ${addedToLib} 人 · 加入本场 ${addedToSquad} 人`);
  }

  function openLibraryPicker() {
    pickerChecked = new Set();
    els.pickerSearch.value = '';
    renderPicker();
    els.dialogLibrary.showModal();
    setTimeout(() => els.pickerSearch.focus(), 30);
  }

  function renderPicker() {
    const q = (els.pickerSearch.value || '').trim().toLowerCase();
    const m = cur();
    const already = new Set(squadPids(m));
    const pids = Object.keys(state.roster).sort((a, b) => {
      const A = state.roster[a], B = state.roster[b];
      if (A.active !== B.active) return A.active ? -1 : 1;
      return A.name.localeCompare(B.name, 'zh');
    });
    const frag = document.createDocumentFragment();
    let shown = 0;
    pids.forEach((pid) => {
      const p = state.roster[pid];
      if (!p.active && !pickerChecked.has(pid)) return;
      if (q && !`${p.name} ${p.number}`.toLowerCase().includes(q)) return;
      shown += 1;
      const label = document.createElement('label');
      label.className = 'picker-item' + (already.has(pid) ? ' is-added' : '');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.dataset.pickerPid = pid;
      cb.checked = already.has(pid) || pickerChecked.has(pid);
      cb.disabled = already.has(pid);
      const nm = document.createElement('span');
      nm.textContent = p.name + (p.number ? ` #${p.number}` : '');
      const tag = document.createElement('span');
      tag.className = 'picker-tag';
      tag.textContent = already.has(pid) ? '已报名' : p.active ? '' : '停用';
      label.appendChild(cb); label.appendChild(nm); label.appendChild(tag);
      frag.appendChild(label);
    });
    els.pickerList.replaceChildren();
    if (!shown) {
      const d = document.createElement('div');
      d.className = 'picker-empty';
      d.textContent = '没有匹配的球员';
      els.pickerList.appendChild(d);
    } else els.pickerList.appendChild(frag);
  }

  function applyPicker() {
    if (!guardEditable()) { els.dialogLibrary.close(); return; }
    const m = cur();
    if (!m) return;
    pushUndo();
    let n = 0;
    pickerChecked.forEach((pid) => {
      if (!state.roster[pid] || m.stats[pid]) return;
      m.pool.push(pid);
      m.stats[pid] = defaultStats();
      n += 1;
    });
    els.dialogLibrary.close();
    changed();
    toast(n ? `已加入本场 ${n} 名球员` : '没有新球员需要加入');
  }

  function registerPids(pids) {
    if (!guardEditable()) return;
    const m = cur();
    if (!m) return;
    pushUndo();
    let n = 0;
    pids.forEach((pid) => {
      if (!state.roster[pid] || m.stats[pid]) return;
      m.pool.push(pid);
      m.stats[pid] = defaultStats();
      n += 1;
    });
    changed();
    toast(n ? `已加入本场 ${n} 名球员` : '这些球员都已在本场名单里');
  }

  function openPlayerDialog(pid) {
    if (!guardEditable()) return;
    editingPlayerId = pid || null;
    const p = pid ? state.roster[pid] : null;
    els.playerDialogTitle.textContent = p ? '编辑球员' : '新增球员';
    els.pdName.value = p ? p.name : '';
    els.pdNumber.value = p ? p.number : '';
    els.pdPosition.value = p ? p.position : '';
    els.pdJoined.value = p ? p.joinedAt : today();
    els.pdNote.value = p ? p.note : '';
    els.pdActive.checked = p ? p.active : true;
    els.dialogPlayer.showModal();
    setTimeout(() => els.pdName.focus(), 30);
  }

  function savePlayerDialog() {
    if (!guardEditable()) { els.dialogPlayer.close(); return; }
    const name = els.pdName.value.trim().slice(0, 24);
    if (!name) { toast('姓名不能为空', 'err'); return; }
    const dup = Object.values(state.roster).find((p) => p.name.toLowerCase() === name.toLowerCase() && p.id !== editingPlayerId);
    if (dup) { toast(`球员库里已有「${dup.name}」，请用「合并」处理重复`, 'err'); return; }
    pushUndo();
    const payload = {
      name,
      number: els.pdNumber.value.trim().slice(0, 5),
      position: ['GK', 'DF', 'MF', 'FW'].includes(els.pdPosition.value) ? els.pdPosition.value : '',
      joinedAt: els.pdJoined.value || '',
      note: els.pdNote.value.trim().slice(0, 100),
      active: els.pdActive.checked,
    };
    if (editingPlayerId) {
      Object.assign(state.roster[editingPlayerId], payload);
    } else {
      state.seq.player += 1;
      const pid = `pl${state.seq.player}`;
      state.roster[pid] = { id: pid, ...payload };
    }
    els.dialogPlayer.close();
    changed();
    toast(editingPlayerId ? '球员信息已更新' : '已新增球员');
  }

  function openMergeDialog(pid) {
    if (!guardEditable()) return;
    mergeSourceId = pid;
    els.mergeSource.textContent = rosterName(pid);
    const others = Object.values(state.roster)
      .filter((p) => p.id !== pid)
      .sort((a, b) => (a.active === b.active ? a.name.localeCompare(b.name, 'zh') : a.active ? -1 : 1));
    els.mergeTarget.replaceChildren();
    if (!others.length) {
      const o = document.createElement('option');
      o.textContent = '（没有其他球员可合并）';
      o.value = '';
      els.mergeTarget.appendChild(o);
    } else {
      others.forEach((p) => {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = `${p.name}${p.active ? '' : '（停用）'}`;
        els.mergeTarget.appendChild(o);
      });
    }
    els.dialogMerge.showModal();
  }

  function applyMerge() {
    if (!guardEditable() || !mergeSourceId) { els.dialogMerge.close(); return; }
    const target = els.mergeTarget.value;
    if (!target || target === mergeSourceId || !state.roster[target]) { els.dialogMerge.close(); return; }
    const src = mergeSourceId;
    pushUndo();
    matchList().forEach((m) => {
      m.teams.forEach((t) => { t.players = t.players.map((p) => (p === src ? target : p)); });
      m.pool = m.pool.map((p) => (p === src ? target : p));
      if (m.stats[src]) {
        const a = m.stats[src];
        const b = m.stats[target];
        if (b) {
          m.stats[target] = {
            present: a.present !== false || b.present !== false,
            goals: (a.goals || 0) + (b.goals || 0),
            assists: (a.assists || 0) + (b.assists || 0),
            mvp: Boolean(a.mvp || b.mvp), svp: Boolean(a.svp || b.svp),
            cleanSheet: Boolean(a.cleanSheet || b.cleanSheet),
          };
        } else m.stats[target] = { ...a };
        delete m.stats[src];
      }
      // 去重
      m.teams.forEach((t) => { t.players = Array.from(new Set(t.players)); });
      m.pool = Array.from(new Set(m.pool));
    });
    state.roster[src].active = false;
    state.roster[src].note = `${state.roster[src].note} [已合并至 ${state.roster[target].name}]`.trim().slice(0, 100);
    els.dialogMerge.close();
    changed();
    toast(`已把 ${state.roster[src].name} 的历史记录合并到 ${state.roster[target].name}`);
  }

  function openMatchDialog(editId) {
    if (!guardEditable()) return;
    editingMatchId = editId || null;
    const m = editId ? state.matches[editId] : null;
    els.matchDialogTitle.textContent = m ? '编辑比赛设置' : '新建比赛';
    els.mdDate.value = m ? m.date : today();
    els.mdType.value = m ? m.type : 'internal';
    els.mdVenue.value = m ? m.venue : '';
    els.mdKickoff.value = m ? m.kickoff : '';
    els.mdOpponent.value = m ? m.opponent : '';
    els.mdNote.value = m ? m.note : '';
    els.mdCopySquad.parentElement.hidden = Boolean(m);
    els.mdCopySquad.checked = false;
    els.dialogMatch.showModal();
    setTimeout(() => els.mdDate.focus(), 30);
  }

  function saveMatchDialog() {
    if (!guardEditable()) { els.dialogMatch.close(); return; }
    const type = els.mdType.value === 'external' ? 'external' : 'internal';
    const opponent = els.mdOpponent.value.trim().slice(0, 40);
    if (type === 'external' && !opponent) { toast('外战需要填写对手名称', 'err'); return; }
    pushUndo();

    if (editingMatchId) {
      const m = state.matches[editingMatchId];
      m.date = els.mdDate.value || '';
      m.type = type;
      m.venue = els.mdVenue.value.trim().slice(0, 40);
      m.kickoff = els.mdKickoff.value || '';
      m.opponent = opponent;
      m.note = els.mdNote.value.trim().slice(0, 100);
      if (type === 'internal') m.opponentScore = null;
    } else {
      const src = els.mdCopySquad.checked ? cur() : null;
      const m = newMatch({
        state,
        date: els.mdDate.value || today(),
        type,
        venue: els.mdVenue.value.trim().slice(0, 40),
        kickoff: els.mdKickoff.value || '',
        opponent,
        note: els.mdNote.value.trim().slice(0, 100),
      });
      if (src) {
        m.teams = src.teams.map((t) => ({ ...t, players: [...t.players] }));
        m.pool = [...src.pool];
        Object.keys(src.stats).forEach((pid) => {
          if (state.roster[pid]) m.stats[pid] = defaultStats();
        });
      }
      state.matches[m.id] = m;
      state.currentMatchId = m.id;
    }
    els.dialogMatch.close();
    fillPeriodSelects();
    changed();
    toast(editingMatchId ? '比赛设置已更新' : '已新建比赛');
    if (!editingMatchId) setView('match');
  }

  /* ==========================================================
     导入
     ========================================================== */
  function triggerImport(mode) {
    importMode = mode;
    const input = mode === 'merge' ? els.importFile2 : els.importFile;
    input.value = '';
    input.click();
  }

  function handleImport(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const raw = parsed && parsed.state ? parsed.state : parsed;
        const incoming = raw.version === 3 ? normalizeV3(raw) : migrateV2(raw);
        if (!incoming) throw new Error('bad');
        const errs = validateState(incoming);
        if (errs.length) throw new Error(errs[0]);
        if (importMode === 'cover') {
          try { localStorage.setItem(PRE_IMPORT_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
          pushUndo();
          state = incoming;
          ensureMatch(state);
        } else {
          pushUndo();
          mergeState(incoming);
        }
        libChecked = new Set();
        selectedId = null;
        changed();
        toast(importMode === 'cover' ? '已覆盖导入整库数据' : '已合并导入整库数据');
      } catch (err) {
        toast('这个文件读不出来或校验失败，请选择本应用导出的备份文件', 'err');
      }
    };
    reader.onerror = () => toast('读取文件失败', 'err');
    reader.readAsText(file, 'utf-8');
  }

  function mergeState(inc) {
    const byName = new Map(Object.values(state.roster).map((p) => [p.name.toLowerCase(), p.id]));
    const remap = {};
    Object.values(inc.roster).forEach((p) => {
      const key = p.name.toLowerCase();
      if (byName.has(key)) { remap[p.id] = byName.get(key); return; }
      state.seq.player += 1;
      const pid = `pl${state.seq.player}`;
      state.roster[pid] = { ...p, id: pid };
      byName.set(key, pid);
      remap[p.id] = pid;
    });
    const conv = (pid) => remap[pid] || null;
    Object.values(inc.matches).forEach((src) => {
      if (state.matches[src.id]) return;   // 按比赛 ID 去重，保留本地
      const m = {
        ...src,
        teams: src.teams.map((t) => ({ ...t, players: t.players.map(conv).filter(Boolean) })),
        pool: src.pool.map(conv).filter(Boolean),
        stats: {},
      };
      Object.entries(src.stats).forEach(([pid, st]) => {
        const np = conv(pid);
        if (np) m.stats[np] = { ...st };
      });
      state.matches[src.id] = m;
      state.seq.match = Math.max(state.seq.match, Number(String(src.id).replace(/\D/g, '')) || 0);
    });
    ensureMatch(state);
  }

  /* ==========================================================
     交互：数据操作
     ========================================================== */
  function addPlayersToSquad(names) {
    if (!guardEditable()) return 0;
    const m = cur();
    if (!m) return 0;
    pushUndo();
    const byName = new Map(Object.values(state.roster).map((p) => [p.name.toLowerCase(), p.id]));
    let n = 0;
    names.forEach((raw) => {
      const name = String(raw).trim().slice(0, 24);
      if (!name) return;
      const key = name.toLowerCase();
      let pid = byName.get(key);
      if (!pid) {
        if (Object.keys(state.roster).length >= MAX_PLAYERS) return;
        state.seq.player += 1;
        pid = `pl${state.seq.player}`;
        state.roster[pid] = { id: pid, name, number: '', position: '', joinedAt: today(), active: true, note: '' };
        byName.set(key, pid);
      }
      if (m.stats[pid]) return;
      m.pool.push(pid);
      m.stats[pid] = defaultStats();
      n += 1;
    });
    changed();
    return n;
  }

  function removeFromSquad(pid) {
    if (!guardEditable()) return;
    const m = cur();
    if (!m) return;
    pushUndo();
    m.pool = m.pool.filter((p) => p !== pid);
    m.teams.forEach((t) => { t.players = t.players.filter((p) => p !== pid); });
    delete m.stats[pid];
    if (selectedId === pid) selectedId = null;
    changed();
    toast(`已从本场移除 ${rosterName(pid)}（球员库保留）`);
  }

  function movePlayer(pid, dest) {
    const m = cur();
    if (!m) return false;
    const loc = locate(pid);
    if (!loc) return false;
    if (dest === 'pool' && loc.type === 'pool') return false;
    if (loc.type === 'team' && dest === loc.team.id) return false;
    const target = dest === 'pool' ? null : m.teams.find((t) => t.id === dest);
    if (dest !== 'pool' && !target) return false;
    if (!guardEditable()) return false;
    pushUndo();
    m.pool = m.pool.filter((p) => p !== pid);
    m.teams.forEach((t) => { t.players = t.players.filter((p) => p !== pid); });
    if (target) target.players.push(pid);
    else m.pool.push(pid);
    changed();
    return true;
  }

  function setTeamCount(n) {
    const m = cur();
    if (!m) return;
    const count = Math.max(MIN_TEAMS, Math.min(MAX_TEAMS, Math.round(n)));
    if (count === m.teams.length) { els.teamCount.value = String(count); return; }
    if (!guardEditable()) { els.teamCount.value = String(m.teams.length); return; }
    pushUndo();
    while (m.teams.length < count) m.teams.push(makeTeam(m.teams, state));
    while (m.teams.length > count) {
      const t = m.teams.pop();
      m.pool.push(...t.players);
      delete m.scores[t.id];
    }
    changed();
  }

  function removeTeam(teamId) {
    if (!guardEditable()) return;
    const m = cur();
    if (!m) return;
    if (m.teams.length <= MIN_TEAMS) { toast(`至少保留 ${MIN_TEAMS} 支球队`, 'err'); return; }
    const i = m.teams.findIndex((t) => t.id === teamId);
    if (i < 0) return;
    pushUndo();
    const [t] = m.teams.splice(i, 1);
    m.pool.push(...t.players);
    delete m.scores[t.id];
    changed();
    toast(`${t.name} 已移除，球员回到替补席`);
  }

  function clearTeams() {
    if (!guardEditable()) return;
    const m = cur();
    if (!m) return;
    pushUndo();
    m.teams.forEach((t) => { m.pool.push(...t.players); t.players = []; });
    changed();
    toast('所有球员已回到替补席');
  }

  function clearSquad() {
    if (!guardEditable()) return;
    const m = cur();
    if (!m || !squadPids(m).length) return;
    pushUndo();
    m.pool = [];
    m.teams.forEach((t) => { t.players = []; });
    m.stats = {};
    m.scores = {};
    selectedId = null;
    changed();
    toast('本场报名名单已清空（球员库保留）');
  }

  function distributePool() {
    const m = cur();
    if (!m || !m.pool.length) return false;
    const ids = [...m.pool];
    m.pool = [];
    ids.forEach((pid) => {
      const min = Math.min(...m.teams.map((t) => t.players.length));
      const cand = m.teams.filter((t) => t.players.length === min);
      cand[Math.floor(Math.random() * cand.length)].players.push(pid);
    });
    return true;
  }

  function shuffleAll() {
    if (!guardEditable()) return;
    const m = cur();
    if (!m || !squadPids(m).length) { toast('本场还没有报名球员', 'err'); return; }
    pushUndo();
    m.pool = squadPids(m);
    m.teams.forEach((t) => { t.players = []; });
    distributePool();
    changed();
    toast('已随机重新分队');
  }

  function undo() {
    if (!guardEditable()) return;
    const prev = undoStack.pop();
    if (!prev) return;
    try {
      const data = JSON.parse(prev);
      state.roster = data.roster;
      state.matches = data.matches;
      state.seq = data.seq;
      state.currentMatchId = data.currentMatchId;
      ensureMatch(state);
      selectedId = null;
      changed();
      toast('已撤销上一步');
    } catch (e) { toast('撤销失败', 'err'); }
  }

  function updateMatchField(field, value) {
    if (!guardEditable()) return;
    const m = cur();
    if (!m) return;
    const next = String(value || '').slice(0, field === 'kickoff' ? 32 : 40);
    if (m[field] === next) return;
    m[field] = next;
    if (field === 'kickoff' && DATE_RE.test(next)) m.date = next.slice(0, 10);
    changed();
  }

  function clearMatchInfo() {
    if (!guardEditable()) return;
    const m = cur();
    if (!m) return;
    if (!m.venue && !m.kickoff && !m.opponent) { toast('比赛信息已经是空的'); return; }
    pushUndo();
    m.venue = ''; m.kickoff = ''; m.opponent = '';
    changed();
    toast('比赛信息已清空');
  }

  function updateScore(field, value, opts) {
    if (!guardEditable()) return;
    const m = cur();
    if (!m) return;
    const v = value === '' ? null : intOrNull(value);
    if (field === 'opponent') {
      if (m.opponentScore === v) return;
      m.opponentScore = v;
    } else {
      const prev = Number.isInteger(m.scores[field]) ? m.scores[field] : null;
      if (prev === v) return;
      if (v === null) delete m.scores[field];
      else m.scores[field] = v;
    }
    changed(opts);
  }

  function updateStat(pid, field, value) {
    if (!guardEditable()) return;
    const m = cur();
    if (!m || !m.stats[pid]) return;
    const st = m.stats[pid];
    if (field === 'present') {
      st.present = Boolean(value);
      if (!st.present) {
        st.goals = 0; st.assists = 0; st.mvp = false; st.svp = false; st.cleanSheet = false;
      }
    } else if (field === 'goals' || field === 'assists') {
      st[field] = value === '' ? 0 : (intOrNull(value) || 0);
    } else {
      st[field] = Boolean(value);
    }
    changed();
  }

  function setAward(pid, award) {
    if (!guardEditable()) return;
    const m = cur();
    if (!m || !m.stats[pid]) return;
    const st = m.stats[pid];
    if (st.present === false) return;
    const other = award === 'mvp' ? 'svp' : 'mvp';
    const turningOn = !st[award];

    // 评选范围提示（不强制阻止，按 SPEC 允许手动标记）
    const winners = winningTeamIds(m);
    const losers = losingTeamIds(m);
    const t = teamOf(m, pid);
    if (turningOn && hasResult(m)) {
      const allowed = award === 'mvp' ? winners : losers;
      if (!allowed.length || !t || !allowed.includes(t.id)) {
        toast(`${award.toUpperCase()} 通常应来自${award === 'mvp' ? '胜队' : '输队'}，已允许手动标记`, 'err');
      }
    }
    pushUndo();
    Object.values(m.stats).forEach((s) => { s[award] = false; });
    st[award] = turningOn;
    if (turningOn) st[other] = false;
    changed();
  }

  /* ==========================================================
     拖拽
     ========================================================== */
  let drag = null;

  function clearTargets() { $$('.is-target').forEach((el) => el.classList.remove('is-target')); }

  function zoneAt(x, y) {
    const el = document.elementFromPoint(x, y);
    return el && el.closest('[data-zone]');
  }

  function beginDrag(event) {
    const chip = event.target.closest('.chip');
    if (!chip || event.target.closest('.remove')) return;
    const pid = chip.dataset.pid;
    if (!cur() || !cur().stats[pid]) return;
    if (readOnly) {
      if (event.pointerType !== 'touch') selectPlayer(pid === selectedId ? null : pid);
      return;
    }
    drag = {
      pid, chip, pointerId: event.pointerId,
      x0: event.clientX, y0: event.clientY, x: event.clientX, y: event.clientY,
      active: false, touch: event.pointerType === 'touch', ghost: null, zone: null,
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
  }

  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    drag.x = e.clientX; drag.y = e.clientY;
    if (!drag.active) {
      const dx = drag.x - drag.x0, dy = drag.y - drag.y0;
      const d = Math.hypot(dx, dy);
      const horizontal = Math.abs(dx) > Math.abs(dy) * 1.15;
      const threshold = drag.touch ? 12 : 5;
      if (d < threshold) return;
      if (drag.touch && !horizontal) { endDragListeners(); drag = null; return; }
      activateDrag();
    }
    e.preventDefault();
    if (drag.ghost) { drag.ghost.style.left = `${drag.x}px`; drag.ghost.style.top = `${drag.y}px`; }
    const zone = zoneAt(drag.x, drag.y);
    if (zone !== drag.zone) {
      clearTargets();
      drag.zone = zone;
      if (zone) zone.classList.add('is-target');
    }
  }

  function activateDrag() {
    drag.active = true;
    document.body.classList.add('dragging');
    drag.chip.classList.add('is-dragging');
    const g = document.createElement('div');
    g.className = 'drag-ghost';
    g.textContent = rosterName(drag.pid);
    g.style.left = `${drag.x}px`;
    g.style.top = `${drag.y}px`;
    document.body.appendChild(g);
    drag.ghost = g;
  }

  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (drag.active) {
      const zone = zoneAt(drag.x, drag.y);
      const pid = drag.pid;
      endDrag();
      suppressClickUntil = Date.now() + 260;
      if (zone && movePlayer(pid, zone.dataset.zone)) {
        const dest = zone.dataset.zone;
        const label = dest === 'pool' ? '替补席' : (cur().teams.find((t) => t.id === dest) || {}).name || '球队';
        toast(`${rosterName(pid)} → ${label}`);
      }
      return;
    }
    const pid = drag.pid;
    endDrag();
    selectPlayer(pid === selectedId ? null : pid);
  }

  function onPointerCancel() { endDrag(); }

  function endDragListeners() {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
  }

  function endDrag() {
    endDragListeners();
    clearTargets();
    document.body.classList.remove('dragging');
    if (drag) {
      drag.chip.classList.remove('is-dragging');
      if (drag.ghost) drag.ghost.remove();
    }
    drag = null;
  }

  function selectPlayer(pid) {
    selectedId = pid;
    $$('.chip.selected').forEach((el) => el.classList.remove('selected'));
    if (pid) $$(`.chip[data-pid="${CSS.escape(pid)}"]`).forEach((el) => el.classList.add('selected'));
  }

  async function copyShareUrl() {
    const url = els.shareUrl.value;
    try { await navigator.clipboard.writeText(url); toast('分享链接已复制'); }
    catch (e) {
      els.shareUrl.focus(); els.shareUrl.select();
      const ok = document.execCommand && document.execCommand('copy');
      toast(ok ? '分享链接已复制' : '请手动复制选中的链接', ok ? '' : 'err');
    }
  }

  /* ==========================================================
     事件绑定
     ========================================================== */
  function bind() {
    // 分区切换
    els.appTabs.addEventListener('click', (e) => {
      const b = e.target.closest('.app-tab');
      if (b) setView(b.dataset.view);
    });

    // 头部
    els.btnUndo.addEventListener('click', undo);
    els.btnShare.addEventListener('click', openShare);
    els.shareCopy.addEventListener('click', copyShareUrl);
    els.btnBackup.addEventListener('click', () => {
      els.backupMeta.textContent = `球员 ${Object.keys(state.roster).length} 名 · 比赛 ${matchList().length} 场 · 上次保存 ${state.updatedAt ? formatKickoff(state.updatedAt) : '尚未保存'}`;
      els.dialogBackup.showModal();
    });
    els.btnStorageBackup.addEventListener('click', () => els.btnBackup.click());
    els.btnReset.addEventListener('click', async () => {
      if (!guardEditable()) return;
      const ok = await confirmDialog('重置全部数据', '将清空球员库、全部比赛与统计记录，此操作不可恢复（可撤销一次）。', '重置');
      if (!ok) return;
      pushUndo();
      state = freshState();
      libChecked = new Set();
      selectedId = null;
      fillPeriodSelects();
      changed();
      toast('已重置');
    });

    // 对话框通用关闭
    $$('dialog [data-close]').forEach((b) => {
      b.addEventListener('click', () => { const d = b.closest('dialog'); if (d) d.close(); });
    });

    // 比赛切换器
    els.matchSelect.addEventListener('change', () => {
      if (els.matchSelect.value && state.matches[els.matchSelect.value]) {
        state.currentMatchId = els.matchSelect.value;
        selectedId = null;
        persist();
        render();
      }
    });
    els.btnNewMatch.addEventListener('click', () => openMatchDialog(null));
    els.btnArchiveNew.addEventListener('click', () => openMatchDialog(null));
    els.btnMatchSettings.addEventListener('click', () => openMatchDialog(state.currentMatchId));
    els.btnDeleteMatch.addEventListener('click', async () => {
      if (!guardEditable()) return;
      if (matchList().length <= 1) { toast('至少要保留一场比赛', 'err'); return; }
      const m = cur();
      const ok = await confirmDialog('删除本场比赛', `将删除 ${m.date || '未设日期'} 这场比赛及其全部单场数据，球员库不受影响。`, '删除');
      if (!ok) return;
      pushUndo();
      delete state.matches[m.id];
      ensureMatch(state);
      changed();
      toast('比赛已删除');
    });
    els.matchOk.addEventListener('click', saveMatchDialog);
    els.mdType.addEventListener('change', () => {
      els.mdOpponent.parentElement.style.opacity = els.mdType.value === 'external' ? '1' : '.5';
    });

    // 比赛信息
    els.matchVenue.addEventListener('input', () => updateMatchField('venue', els.matchVenue.value));
    els.matchKickoff.addEventListener('input', () => updateMatchField('kickoff', els.matchKickoff.value));
    els.matchOpponent.addEventListener('input', () => updateMatchField('opponent', els.matchOpponent.value));
    els.matchClear.addEventListener('click', clearMatchInfo);

    // 比分条（input 与 change 都监听：敲数字时实时生效，不必等失焦）
    const onScoreStrip = (e) => {
      const inp = e.target;
      const opts = { skipRender: e.type === 'input' };
      if (inp.dataset.scoreTeam) updateScore(inp.dataset.scoreTeam, inp.value, opts);
      else if (inp.dataset.scoreOpponent) updateScore('opponent', inp.value, opts);
    };
    els.ssTeams.addEventListener('input', onScoreStrip);
    els.ssTeams.addEventListener('change', onScoreStrip);

    // 本场名单
    els.playerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const raw = els.playerInput.value;
      if (!raw.trim()) return;
      const names = raw.split(/[\n\r,，、;；\t]+/).map((s) => s.trim()).filter(Boolean);
      const n = addPlayersToSquad(names);
      if (n) { els.playerInput.value = ''; els.rosterList.scrollTop = els.rosterList.scrollHeight; }
    });
    els.search.addEventListener('input', renderRosterList);
    els.btnFromLibrary.addEventListener('click', openLibraryPicker);
    els.btnBatch.addEventListener('click', () => openBatch('squad'));
    els.btnClearRoster.addEventListener('click', clearSquad);
    els.btnDemo.addEventListener('click', () => {
      const n = addPlayersToSquad(DEMO_PLAYERS);
      if (n) toast(`已加入 ${n} 名示例球员`);
    });
    els.pickerSearch.addEventListener('input', renderPicker);
    els.pickerList.addEventListener('change', (e) => {
      const cb = e.target.closest('[data-picker-pid]');
      if (!cb) return;
      if (cb.checked) pickerChecked.add(cb.dataset.pickerPid);
      else pickerChecked.delete(cb.dataset.pickerPid);
    });
    els.pickerOk.addEventListener('click', applyPicker);

    // 队数 / 分队
    els.teamCount.addEventListener('change', () => {
      const v = Number(els.teamCount.value);
      if (Number.isFinite(v)) setTeamCount(v);
      else els.teamCount.value = String(cur() ? cur().teams.length : MIN_TEAMS);
    });
    $$('.stepper button[data-step]').forEach((b) => {
      b.addEventListener('click', () => setTeamCount(cur().teams.length + Number(b.dataset.step)));
    });
    els.btnShuffle.addEventListener('click', async () => {
      if (!guardEditable()) return;
      const m = cur();
      if (!m || !squadPids(m).length) { toast('本场还没有报名球员', 'err'); return; }
      if (m.pool.length) {
        pushUndo(); distributePool(); changed(); toast('替补球员已随机分入各队'); return;
      }
      const ok = await confirmDialog('随机重新分队', '所有球员已经分队完毕，要打乱重新分配吗？', '重新分队');
      if (ok) shuffleAll();
    });
    els.btnClearTeams.addEventListener('click', clearTeams);

    // 球员库
    els.btnPlayerAdd.addEventListener('click', () => openPlayerDialog(null));
    els.btnPlayerBatch.addEventListener('click', () => openBatch('library'));
    els.playerOk.addEventListener('click', savePlayerDialog);
    els.btnImport.addEventListener('click', () => triggerImport('cover'));
    els.libSearch.addEventListener('input', renderLibrary);
    els.libraryBody.addEventListener('change', (e) => {
      const cb = e.target.closest('.lib-check');
      if (!cb) return;
      if (cb.checked) libChecked.add(cb.dataset.pid);
      else libChecked.delete(cb.dataset.pid);
      updateLibSelected();
    });
    els.libCheckAll.addEventListener('change', () => {
      const pids = $$('#library-body .lib-check').map((c) => c.dataset.pid);
      if (els.libCheckAll.checked) pids.forEach((p) => libChecked.add(p));
      else pids.forEach((p) => libChecked.delete(p));
      renderLibrary();
    });
    els.libraryBody.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const pid = b.dataset.pid;
      if (b.dataset.act === 'edit-player') openPlayerDialog(pid);
      else if (b.dataset.act === 'merge-player') openMergeDialog(pid);
      else if (b.dataset.act === 'toggle-player') {
        if (!guardEditable()) return;
        pushUndo();
        state.roster[pid].active = !state.roster[pid].active;
        changed();
        toast(state.roster[pid].active ? '已启用球员' : '已停用球员（历史记录保留）');
      }
    });
    els.mergeOk.addEventListener('click', applyMerge);
    els.btnRegisterSelected.addEventListener('click', () => registerPids(Array.from(libChecked)));
    els.btnRegisterActive.addEventListener('click', () => registerPids(Object.keys(state.roster).filter((p) => state.roster[p].active)));

    // 比赛档案
    els.archiveType.addEventListener('change', renderArchive);
    els.archivePeriod.addEventListener('change', renderArchive);
    els.matchCards.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const card = b.closest('.match-card');
      const mid = card && card.dataset.mid;
      const m = mid && state.matches[mid];
      if (!m) return;
      const act = b.dataset.act;
      if (act === 'toggle-stats') {
        if (expandedCards.has(mid)) expandedCards.delete(mid); else expandedCards.add(mid);
        renderArchive();
      } else if (act === 'open-match') {
        state.currentMatchId = mid; selectedId = null; persist(); setView('match'); render();
      } else if (act === 'edit-match') {
        openMatchDialog(mid);
      } else if (act === 'export-match') {
        downloadFile(`单场名单_${m.date || m.id}.txt`, matchText(m), 'text/plain;charset=utf-8');
        toast('单场名单已导出');
      } else if (act === 'delete-match') {
        if (!guardEditable()) return;
        if (matchList().length <= 1) { toast('至少要保留一场比赛', 'err'); return; }
        confirmDialog('删除比赛', `将删除 ${m.date || '未设日期'} 这场比赛及其全部单场数据。`, '删除').then((ok) => {
          if (!ok) return;
          pushUndo();
          delete state.matches[mid];
          ensureMatch(state);
          changed();
          toast('比赛已删除');
        });
      }
    });
    const onArchiveChange = (e) => {
      const inp = e.target;
      const isCheckbox = inp.type === 'checkbox';
      // 复选框交给 change 一次处理即可，避免 input+change 重复触发
      if (isCheckbox && e.type === 'input') return;
      const card = inp.closest('.match-card');
      if (!card) return;
      const m = state.matches[card.dataset.mid];
      if (!m) return;
      const opts = { skipRender: e.type === 'input' && !isCheckbox };
      if (inp.dataset.scoreTeam) { updateScoreFromCard(m, inp.dataset.scoreTeam, inp.value, opts); return; }
      if (inp.dataset.scoreOpponent) { updateScoreFromCard(m, 'opponent', inp.value, opts); return; }
      const pid = inp.dataset.pid;
      if (inp.dataset.statPresent) { updateStatFromCard(m, pid, 'present', inp.checked, opts); return; }
      if (inp.dataset.statNum) { updateStatFromCard(m, pid, inp.dataset.statNum, inp.value, opts); return; }
      if (inp.dataset.statBool) { updateStatFromCard(m, pid, inp.dataset.statBool, inp.checked, opts); return; }
    };
    els.matchCards.addEventListener('input', onArchiveChange);
    els.matchCards.addEventListener('change', onArchiveChange);
    els.matchCards.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act="award"]');
      if (!b) return;
      const card = b.closest('.match-card');
      const m = state.matches[card.dataset.mid];
      if (m) setAwardFromCard(m, b.dataset.pid, b.dataset.award);
    });

    // 统计
    els.statsPeriod.addEventListener('change', renderStats);
    els.statsType.addEventListener('change', renderStats);
    els.btnStatsCsv.addEventListener('click', () => {
      downloadFile(`排行榜_${today()}.csv`, statsCsv(), 'text/csv;charset=utf-8');
      toast('排行榜 CSV 已导出');
    });

    // 备份对话框
    els.backupDownload.addEventListener('click', () => {
      downloadFile(`足球分队_整库备份_${today()}.json`, JSON.stringify(backupPayload(), null, 2), 'application/json');
      toast('整库备份已下载');
    });
    els.backupCsv.addEventListener('click', () => {
      downloadFile(`比赛明细_${today()}.csv`, matchesCsv(), 'text/csv;charset=utf-8');
      toast('比赛明细 CSV 已导出');
    });
    els.backupImportCover.addEventListener('click', () => triggerImport('cover'));
    els.backupImportMerge.addEventListener('click', () => triggerImport('merge'));
    els.importFile.addEventListener('change', () => { const f = els.importFile.files[0]; if (f) handleImport(f); });
    els.importFile2.addEventListener('change', () => { const f = els.importFile2.files[0]; if (f) handleImport(f); });

    // 批量
    els.batchOk.addEventListener('click', applyBatch);

    // 只读预览
    els.btnAdopt.addEventListener('click', () => adoptShared(readShared()));
    els.btnExitView.addEventListener('click', () => {
      readOnly = false;
      document.body.classList.remove('is-readonly');
      els.viewbar.hidden = true;
      clearHash();
      if (localStateBeforePreview) {
        state = localStateBeforePreview;
        localStateBeforePreview = null;
      } else {
        state = loadState().state;
      }
      render();
      setSaveStatus('ok', '已存本机');
      toast('已回到你自己的数据');
    });

    // 拖拽
    document.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target.closest('input, textarea, select, button')) return;
      if (e.target.closest('.app-view[hidden]')) return;
      beginDrag(e);
    });

    // 点击动作
    document.addEventListener('click', (e) => {
      if (Date.now() < suppressClickUntil) return;
      const action = e.target.closest('[data-act]');
      if (action) {
        // 档案 / 球员库里的动作已各自委托处理，避免重复
        if (action.closest('#match-cards') || action.closest('#library-body')) return;
        const act = action.dataset.act;
        const pid = action.closest('.chip') ? action.closest('.chip').dataset.pid : null;
        if (act === 'remove-squad' && pid) removeFromSquad(pid);
        else if (act === 'to-pool' && pid) movePlayer(pid, 'pool');
        else if (act === 'remove-team') removeTeam(action.dataset.team);
        e.stopPropagation();
        return;
      }
      if (e.target.closest('.chip')) return;
      if (e.target.closest('input, button, select, textarea, .team-name')) return;
      const zone = e.target.closest('[data-zone]');
      if (!zone || !selectedId) return;
      if (movePlayer(selectedId, zone.dataset.zone)) {
        const dest = zone.dataset.zone;
        const label = dest === 'pool' ? '替补席' : (cur().teams.find((t) => t.id === dest) || {}).name || '球队';
        toast(`${rosterName(selectedId)} → ${label}`);
      }
    });

    // 球队改名 / 换色
    els.teams.addEventListener('change', (e) => {
      const input = e.target.closest('.team-name');
      if (!input) return;
      const m = cur();
      const team = m && m.teams.find((t) => t.id === input.dataset.team);
      if (!team) return;
      const name = input.value.trim().slice(0, 16) || `球队${m.teams.indexOf(team) + 1}`;
      if (name === team.name) { input.value = team.name; return; }
      if (!guardEditable()) { input.value = team.name; return; }
      pushUndo();
      team.name = name;
      changed();
    });
    els.teams.addEventListener('input', (e) => {
      const picker = e.target.closest('.kit-color');
      if (!picker) return;
      const m = cur();
      const team = m && m.teams.find((t) => t.id === picker.dataset.team);
      if (!team) return;
      const color = normalizeColor(picker.value, team.color);
      if (color === team.color) return;
      if (!guardEditable()) { picker.value = team.color; return; }
      pushUndo();
      team.color = color;
      changed();
    });

    // 键盘
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        e.preventDefault(); undo(); return;
      }
      if (e.key === 'Escape' && selectedId) { selectPlayer(null); return; }
      const chip = e.target.closest('.chip');
      if (!chip || e.target.closest('.remove')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const pid = chip.dataset.pid;
        selectPlayer(pid === selectedId ? null : pid);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const pid = chip.dataset.pid;
        const loc = locate(pid);
        if (!loc) return;
        e.preventDefault();
        if (loc.type === 'team') movePlayer(pid, 'pool');
        else removeFromSquad(pid);
      }
    });

    window.addEventListener('hashchange', () => {
      const data = readShared();
      if (!data) return;
      enterReadOnly(data);
      render();
      setSaveStatus('ok', '只读预览');
    });
    window.addEventListener('pagehide', flushSave);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave(); });
  }

  function updateScoreFromCard(m, field, value, opts) {
    if (!guardEditable()) return;
    const v = value === '' ? null : intOrNull(value);
    if (field === 'opponent') {
      if (m.opponentScore === v) return;
      m.opponentScore = v;
    } else {
      const prev = Number.isInteger(m.scores[field]) ? m.scores[field] : null;
      if (prev === v) return;
      if (v === null) delete m.scores[field]; else m.scores[field] = v;
    }
    changed(opts);
  }

  function updateStatFromCard(m, pid, field, value, opts) {
    if (!guardEditable() || !m.stats[pid]) return;
    const st = m.stats[pid];
    if (field === 'present') {
      st.present = Boolean(value);
      if (!st.present) { st.goals = 0; st.assists = 0; st.mvp = false; st.svp = false; st.cleanSheet = false; }
    } else if (field === 'goals' || field === 'assists') {
      st[field] = value === '' ? 0 : (intOrNull(value) || 0);
    } else st[field] = Boolean(value);
    changed(opts);
  }

  function setAwardFromCard(m, pid, award) {
    if (!guardEditable() || !m.stats[pid]) return;
    const st = m.stats[pid];
    if (st.present === false) return;
    const other = award === 'mvp' ? 'svp' : 'mvp';
    const turningOn = !st[award];
    const winners = winningTeamIds(m);
    const losers = losingTeamIds(m);
    const t = teamOf(m, pid);
    if (turningOn && hasResult(m)) {
      const allowed = award === 'mvp' ? winners : losers;
      if (!allowed.length || !t || !allowed.includes(t.id)) {
        toast(`${award.toUpperCase()} 通常应来自${award === 'mvp' ? '胜队' : '输队'}，已允许手动标记`, 'err');
      }
    }
    pushUndo();
    Object.values(m.stats).forEach((s) => { s[award] = false; });
    st[award] = turningOn;
    if (turningOn) st[other] = false;
    changed();
  }

  /* ==========================================================
     启动
     ========================================================== */
  function boot() {
    const shared = readShared();
    if (shared) {
      const loaded = loadState();
      state = loaded.state;
      bind();
      fillPeriodSelects();
      enterReadOnly(shared);
      setView('match');
      render();
      setSaveStatus('ok', '只读预览');
      return;
    }
    const loaded = loadState();
    state = loaded.state;
    bind();
    fillPeriodSelects();
    setView('match');
    render();
    setSaveStatus('ok', loaded.migrated ? '已迁移到 v3' : '已存本机');
    if (loaded.migrated) {
      persist();
      toast('已从旧版本升级到 v3（球员库 + 比赛档案）');
    }
  }

  // 暴露给自动化验收脚本（只读，不修改状态）
  window.__FD__ = {
    getState: () => JSON.parse(JSON.stringify(state)),
    computeStats,
    hasResult,
    winningTeamIds,
    losingTeamIds,
    isWin,
    resultText,
    scopeMatches,
    validate: () => validateState(state),
    BOARDS,
    sortRows,
    version: 3,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
