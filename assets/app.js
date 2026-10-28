/* ============================================================
   FOOTBALL DRAFT · 足球分队系统
   前端逻辑：名单管理 / 球队数量 / 拖拽分队 / 自动保存
   ============================================================ */
(() => {
  'use strict';

  const MIN_TEAMS = 2;
  const MAX_TEAMS = 12;
  const MAX_PLAYERS = 300;
  const LS_KEY = 'football-draft:state:v1';
  const SAVE_DELAY = 450;

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

  const els = {
    rosterList: $('#roster-list'),
    rosterCount: $('#roster-count'),
    playerForm: $('#player-form'),
    playerInput: $('#player-input'),
    search: $('#roster-search'),
    btnBatch: $('#btn-batch'),
    btnClearRoster: $('#btn-clear-roster'),
    teams: $('#teams'),
    boardEmpty: $('#board-empty'),
    boardSub: $('#board-sub'),
    teamCount: $('#team-count'),
    btnShuffle: $('#btn-shuffle'),
    btnClearTeams: $('#btn-clear-teams'),
    btnDemo: $('#btn-demo'),
    btnUndo: $('#btn-undo'),
    btnExport: $('#btn-export'),
    btnShare: $('#btn-share'),
    btnImport: $('#btn-import'),
    btnReset: $('#btn-reset'),
    viewbar: $('#viewbar'),
    btnAdopt: $('#btn-adopt'),
    btnExitView: $('#btn-exit-view'),
    importFile: $('#import-file'),
    dialogShare: $('#dialog-share'),
    shareUrl: $('#share-url'),
    shareMeta: $('#share-meta'),
    shareCopy: $('#share-copy'),
    shareDownload: $('#share-download'),
    pool: $('#pool'),
    trayCount: $('#tray-count'),
    hudPlayers: $('#hud-players'),
    hudTeams: $('#hud-teams'),
    hudPool: $('#hud-pool'),
    hudSave: $('#hud-save'),
    toasts: $('#toasts'),
    dialogBatch: $('#dialog-batch'),
    batchText: $('#batch-text'),
    batchOk: $('#batch-ok'),
    dialogConfirm: $('#dialog-confirm'),
    confirmTitle: $('#confirm-title'),
    confirmText: $('#confirm-text'),
    confirmOk: $('#confirm-ok'),
  };

  /* ----------------------------------------------------------
     状态
     ---------------------------------------------------------- */
  let state = emptyState();
  let selectedId = null;
  let undoStack = [];
  let readOnly = false;
  let sharedState = null;
  let saveTimer = null;
  let suppressClickUntil = 0;

  function emptyState() {
    return {
      version: 1,
      updatedAt: null,
      seq: { player: 0, team: 0 },
      players: {},
      pool: [],
      teams: [],
    };
  }

  function normalize(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const next = emptyState();
    const rawPlayers = raw.players && typeof raw.players === 'object' ? raw.players : {};
    Object.keys(rawPlayers).forEach((pid) => {
      const item = rawPlayers[pid];
      const name = item && typeof item.name === 'string' ? item.name.trim() : '';
      if (!name || !/^[A-Za-z0-9_-]{1,40}$/.test(pid)) return;
      if (Object.keys(next.players).length >= MAX_PLAYERS) return;
      next.players[pid] = { id: pid, name: name.slice(0, 24) };
    });

    const used = new Set();
    const rawTeams = Array.isArray(raw.teams) ? raw.teams : [];
    rawTeams.slice(0, MAX_TEAMS).forEach((item, index) => {
      if (!item || typeof item !== 'object') return;
      const id = typeof item.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(item.id)
        ? item.id
        : `t${index + 1}`;
      if (next.teams.some((t) => t.id === id)) return;
      const players = [];
      (Array.isArray(item.players) ? item.players : []).forEach((pid) => {
        if (typeof pid === 'string' && next.players[pid] && !used.has(pid)) {
          used.add(pid);
          players.push(pid);
        }
      });
      next.teams.push({
        id,
        name: (typeof item.name === 'string' && item.name.trim().slice(0, 16)) || `球队${next.teams.length + 1}`,
        color: /^#[0-9a-fA-F]{6}$/.test(item.color || '') ? String(item.color).toLowerCase() : COLORS[next.teams.length % COLORS.length],
        players,
      });
    });

    (Array.isArray(raw.pool) ? raw.pool : []).forEach((pid) => {
      if (typeof pid === 'string' && next.players[pid] && !used.has(pid)) {
        used.add(pid);
        next.pool.push(pid);
      }
    });

    Object.keys(next.players).forEach((pid) => {
      if (!used.has(pid)) {
        used.add(pid);
        next.pool.push(pid);
      }
    });

    const seq = raw.seq && typeof raw.seq === 'object' ? raw.seq : {};
    next.seq.player = Math.max(
      Number(seq.player) || 0,
      ...Object.keys(next.players).map(suffixNumber),
      0
    );
    next.seq.team = Math.max(
      Number(seq.team) || 0,
      ...next.teams.map((t) => suffixNumber(t.id)),
      0
    );
    next.updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : null;

    if (!next.teams.length) {
      for (let i = 0; i < MIN_TEAMS; i += 1) next.teams.push(makeTeam(next));
    }

    return next;
  }

  function suffixNumber(value) {
    const m = /(\d+)$/.exec(String(value));
    return m ? Number(m[1]) : 0;
  }

  function makeTeam(target) {
    const seq = target.seq;
    seq.team += 1;
    const slot = target.teams.length;
    const colorIndex = slot % COLORS.length;
    const usedNames = new Set(target.teams.map((t) => t.name));
    let name = COLOR_NAMES[colorIndex];
    if (usedNames.has(name)) name = `球队${slot + 1}`;
    if (usedNames.has(name)) name = `球队${slot + 1}-${seq.team}`;
    return {
      id: `t${seq.team}`,
      name,
      color: COLORS[colorIndex],
      players: [],
    };
  }

  /* ----------------------------------------------------------
     基础工具
     ---------------------------------------------------------- */
  function locate(pid) {
    if (state.pool.includes(pid)) return { type: 'pool' };
    for (const team of state.teams) {
      if (team.players.includes(pid)) return { type: 'team', team };
    }
    return null;
  }

  function removeEverywhere(pid) {
    state.pool = state.pool.filter((id) => id !== pid);
    state.teams.forEach((team) => {
      team.players = team.players.filter((id) => id !== pid);
    });
  }

  function playerCount() {
    return Object.keys(state.players).length;
  }

  function snapshot() {
    return JSON.stringify({ players: state.players, pool: state.pool, teams: state.teams, seq: state.seq });
  }

  function pushUndo() {
    undoStack.push(snapshot());
    if (undoStack.length > 60) undoStack.shift();
    els.btnUndo.disabled = false;
  }

  function toast(message, kind = '') {
    while (els.toasts.children.length >= 3) {
      els.toasts.firstElementChild.remove();
    }
    const node = document.createElement('div');
    node.className = `toast ${kind}`.trim();
    node.textContent = message;
    els.toasts.appendChild(node);
    setTimeout(() => {
      node.classList.add('out');
      setTimeout(() => node.remove(), 220);
    }, 2600);
  }

  function shuffleArray(list) {
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  /* ----------------------------------------------------------
     渲染
     ---------------------------------------------------------- */
  function render() {
    renderHud();
    renderRoster();
    renderTeams();
    renderPool();
    els.teamCount.value = String(state.teams.length);
    els.boardSub.textContent = `${state.teams.length} 支球队 · ${playerCount()} 名球员`;
  }

  function renderHud() {
    els.hudPlayers.textContent = String(playerCount());
    els.hudTeams.textContent = String(state.teams.length);
    els.hudPool.textContent = String(state.pool.length);
    els.rosterCount.textContent = `${playerCount()} 人`;
    els.trayCount.textContent = String(state.pool.length);
    els.btnUndo.disabled = undoStack.length === 0;
  }

  function makeChip(pid, index, opts = {}) {
    const player = state.players[pid];
    if (!player) return null;

    const chip = document.createElement(opts.tag || 'div');
    chip.className = 'chip';
    chip.dataset.pid = pid;
    chip.tabIndex = 0;
    chip.setAttribute('role', 'button');
    chip.setAttribute('aria-label', `${player.name}，可拖拽`);

    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = String(index);
    if (opts.accent) num.style.setProperty('--accent', opts.accent);
    chip.appendChild(num);

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = player.name;
    chip.appendChild(name);

    if (opts.where) {
      const where = document.createElement('span');
      where.className = 'where';
      where.style.background = opts.where.color || 'rgba(207,217,205,.4)';
      where.title = opts.where.label;
      chip.appendChild(where);
    }

    const grip = document.createElement('span');
    grip.className = 'grip';
    grip.textContent = '⠿';
    grip.setAttribute('aria-hidden', 'true');
    chip.appendChild(grip);

    if (!readOnly) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove';
      remove.textContent = '✕';
      remove.title = opts.removeTitle || '移除';
      remove.setAttribute('aria-label', remove.title);
      remove.dataset.act = opts.removeAct || 'remove';
      chip.appendChild(remove);
    }

    if (pid === selectedId) chip.classList.add('selected');
    if (opts.placed) chip.classList.add('is-placed');
    return chip;
  }

  function renderRoster() {
    const query = (els.search.value || '').trim().toLowerCase();
    const ids = Object.keys(state.players);
    const frag = document.createDocumentFragment();
    let shown = 0;

    ids.forEach((pid, index) => {
      const player = state.players[pid];
      if (query && !player.name.toLowerCase().includes(query)) return;
      const loc = locate(pid);
      const where = loc && loc.type === 'team'
        ? { color: loc.team.color, label: loc.team.name }
        : { color: 'rgba(207,217,205,.35)', label: '替补席' };
      const chip = makeChip(pid, index + 1, {
        tag: 'li',
        where,
        placed: loc && loc.type === 'team',
        removeTitle: '从名单删除',
        removeAct: 'delete',
      });
      if (chip) {
        frag.appendChild(chip);
        shown += 1;
      }
    });

    els.rosterList.replaceChildren();
    if (!ids.length) {
      const empty = document.createElement('li');
      empty.className = 'roster-empty';
      empty.textContent = '名单还是空的，先添加球员吧';
      els.rosterList.appendChild(empty);
    } else if (!shown) {
      const empty = document.createElement('li');
      empty.className = 'roster-empty';
      empty.textContent = '没有匹配的球员';
      els.rosterList.appendChild(empty);
    } else {
      els.rosterList.appendChild(frag);
    }
  }

  function renderTeams() {
    const hasPlayers = playerCount() > 0;
    els.boardEmpty.hidden = hasPlayers;
    els.teams.hidden = !hasPlayers;

    const frag = document.createDocumentFragment();

    state.teams.forEach((team) => {
      const card = document.createElement('article');
      card.className = 'team dropzone';
      card.dataset.zone = team.id;
      card.style.setProperty('--accent', team.color);

      const head = document.createElement('header');
      head.className = 'team-head';

      const kit = document.createElement('span');
      kit.className = 'kit';
      kit.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 3 5 4.9 2.6 9.3l3.2 1.8 1-1.9V21h10.4V9.2l1 1.9 3.2-1.8L19 4.9 15.4 3a3.4 3.4 0 0 1-6.8 0Z" fill="currentColor"/></svg>';
      head.appendChild(kit);

      const nameInput = document.createElement('input');
      nameInput.className = 'team-name';
      nameInput.value = team.name;
      nameInput.maxLength = 16;
      nameInput.readOnly = readOnly;
      nameInput.setAttribute('aria-label', '球队名称');
      nameInput.dataset.team = team.id;
      head.appendChild(nameInput);

      const count = document.createElement('span');
      count.className = 'team-count';
      count.textContent = `${team.players.length} 人`;
      head.appendChild(count);

      if (!readOnly) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'team-remove';
        removeBtn.textContent = '✕';
        removeBtn.title = '移除球队，球员回到替补席';
        removeBtn.setAttribute('aria-label', removeBtn.title);
        removeBtn.dataset.act = 'remove-team';
        removeBtn.dataset.team = team.id;
        head.appendChild(removeBtn);
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
        team.players.forEach((pid, index) => {
          const chip = makeChip(pid, index + 1, {
            accent: team.color,
            removeTitle: '移回替补席',
            removeAct: 'to-pool',
          });
          if (chip) body.appendChild(chip);
        });
      }
      card.appendChild(body);
      frag.appendChild(card);
    });

    els.teams.replaceChildren(frag);
  }

  function renderPool() {
    const frag = document.createDocumentFragment();
    if (!state.pool.length) {
      const empty = document.createElement('span');
      empty.className = 'tray-empty';
      empty.textContent = playerCount()
        ? '全部球员都已就位，准备开球！'
        : '这里会显示还没有被分队的球员';
      frag.appendChild(empty);
    } else {
      state.pool.forEach((pid, index) => {
        const chip = makeChip(pid, index + 1, {
          removeTitle: '从名单删除',
          removeAct: 'delete',
        });
        if (chip) frag.appendChild(chip);
      });
    }
    els.pool.replaceChildren(frag);
  }

  function setSaveStatus(kind, label) {
    const cell = els.hudSave.parentElement;
    cell.classList.remove('saving', 'error');
    if (kind === 'saving') cell.classList.add('saving');
    if (kind === 'error') cell.classList.add('error');
    els.hudSave.innerHTML = '';
    const dot = document.createElement('i');
    dot.className = 'dot';
    els.hudSave.appendChild(dot);
    els.hudSave.appendChild(document.createTextNode(label));
  }

  /* ----------------------------------------------------------
     数据操作
     ---------------------------------------------------------- */
  function guardEditable() {
    if (!readOnly) return true;
    toast('这是只读预览，点顶部「复制到我的名单」后再编辑', 'err');
    return false;
  }

  function changed() {
    render();
    if (readOnly) {
      setSaveStatus('ok', '只读预览');
      return;
    }
    scheduleSave();
  }

  function addPlayers(names, { silent = false } = {}) {
    if (!guardEditable()) return 0;
    const cleaned = [];
    const seen = new Set(
      Object.values(state.players).map((p) => p.name.toLowerCase())
    );

    names.forEach((raw) => {
      const name = String(raw).trim().slice(0, 24);
      if (!name) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      if (Object.keys(state.players).length + cleaned.length >= MAX_PLAYERS) return;
      seen.add(key);
      cleaned.push(name);
    });

    if (!cleaned.length) {
      if (!silent) toast('没有新的球员可以加入（可能重名或已存在）', 'err');
      return 0;
    }

    pushUndo();
    cleaned.forEach((name) => {
      state.seq.player += 1;
      const pid = `p${state.seq.player}`;
      state.players[pid] = { id: pid, name };
      state.pool.push(pid);
    });

    changed();
    if (!silent) {
      toast(`已加入 ${cleaned.length} 名球员`);
      els.rosterList.scrollTop = els.rosterList.scrollHeight;
    }
    return cleaned.length;
  }

  function deletePlayer(pid) {
    if (!guardEditable()) return;
    const player = state.players[pid];
    if (!player) return;
    pushUndo();
    removeEverywhere(pid);
    delete state.players[pid];
    if (selectedId === pid) selectedId = null;
    changed();
    toast(`已从名单删除 ${player.name}`);
  }

  function movePlayer(pid, dest) {
    const loc = locate(pid);
    if (!loc) return false;
    if (dest === 'pool' && loc.type === 'pool') return false;
    if (loc.type === 'team' && dest === loc.team.id) return false;

    const target = dest === 'pool' ? null : state.teams.find((t) => t.id === dest);
    if (dest !== 'pool' && !target) return false;
    if (!guardEditable()) return false;

    pushUndo();
    removeEverywhere(pid);
    if (target) target.players.push(pid);
    else state.pool.push(pid);

    changed();
    return true;
  }

  function setTeamCount(next) {
    const count = Math.max(MIN_TEAMS, Math.min(MAX_TEAMS, Math.round(next)));
    if (count === state.teams.length) {
      els.teamCount.value = String(state.teams.length);
      return;
    }
    if (!guardEditable()) {
      els.teamCount.value = String(state.teams.length);
      return;
    }

    pushUndo();
    while (state.teams.length < count) state.teams.push(makeTeam(state));
    while (state.teams.length > count) {
      const team = state.teams.pop();
      state.pool.push(...team.players);
      team.players = [];
    }
    changed();
  }

  function addTeam() {
    if (state.teams.length >= MAX_TEAMS) {
      toast(`最多 ${MAX_TEAMS} 支球队`, 'err');
      return;
    }
    pushUndo();
    state.teams.push(makeTeam(state));
    changed();
  }

  function removeTeam(teamId) {
    if (!guardEditable()) return;
    if (state.teams.length <= MIN_TEAMS) {
      toast(`至少保留 ${MIN_TEAMS} 支球队`, 'err');
      return;
    }
    const index = state.teams.findIndex((t) => t.id === teamId);
    if (index < 0) return;
    pushUndo();
    const [team] = state.teams.splice(index, 1);
    state.pool.push(...team.players);
    changed();
    toast(`${team.name} 已移除，球员回到替补席`);
  }

  function clearTeams() {
    if (!guardEditable()) return;
    if (!state.teams.some((t) => t.players.length) && !state.pool.length) {
      toast('还没有需要清空的队伍');
      return;
    }
    pushUndo();
    state.teams.forEach((team) => {
      state.pool.push(...team.players);
      team.players = [];
    });
    changed();
    toast('所有球员已回到替补席');
  }

  function clearRoster() {
    if (!guardEditable()) return;
    if (!playerCount()) return;
    pushUndo();
    state.players = {};
    state.pool = [];
    state.teams.forEach((team) => { team.players = []; });
    selectedId = null;
    changed();
    toast('名单已清空');
  }

  function distributePool() {
    if (!state.pool.length) return false;
    const ids = shuffleArray([...state.pool]);
    state.pool = [];
    ids.forEach((pid) => {
      const min = Math.min(...state.teams.map((t) => t.players.length));
      const candidates = state.teams.filter((t) => t.players.length === min);
      const target = candidates[Math.floor(Math.random() * candidates.length)];
      target.players.push(pid);
    });
    return true;
  }

  function shuffleAll() {
    if (!guardEditable()) return;
    const all = Object.keys(state.players);
    if (!all.length) {
      toast('名单还是空的', 'err');
      return;
    }
    pushUndo();
    state.pool = [...all];
    state.teams.forEach((team) => { team.players = []; });
    distributePool();
    changed();
    toast('已随机重新分队');
  }

  function undo() {
    if (!guardEditable()) return;
    const previous = undoStack.pop();
    if (!previous) return;
    const restored = normalize(JSON.parse(previous));
    if (!restored) return;
    state = restored;
    if (selectedId && !state.players[selectedId]) selectedId = null;
    changed();
    toast('已撤销上一步');
  }

  /* ----------------------------------------------------------
     本地保存（纯前端：数据只存在这台设备的 localStorage 里）
     ---------------------------------------------------------- */
  function scheduleSave() {
    setSaveStatus('saving', '保存中');
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      persist();
    }, SAVE_DELAY);
  }

  function persist() {
    if (readOnly) return false;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
      setSaveStatus('ok', '已存本机');
      return true;
    } catch (err) {
      setSaveStatus('error', '存不下');
      toast('浏览器存储不可用（可能是无痕模式），这次改动不会被保存', 'err');
      return false;
    }
  }

  function flushSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
      persist();
    }
  }

  /* ----------------------------------------------------------
     分享链接 / 备份 / 只读预览
     ---------------------------------------------------------- */
  function base64UrlEncode(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function base64UrlDecode(text) {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded + '==='.slice((padded.length + 3) % 4));
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function sharePayload() {
    return {
      v: 1,
      p: Object.values(state.players).map((p) => p.name),
      t: state.teams.map((team) => ({
        n: team.name,
        c: team.color,
        p: team.players.map((pid) => state.players[pid].name),
      })),
      b: state.pool.map((pid) => state.players[pid].name),
    };
  }

  function buildShareUrl() {
    const hash = base64UrlEncode(JSON.stringify(sharePayload()));
    const url = new URL(window.location.href);
    url.hash = `d=${hash}`;
    url.search = '';
    return url.toString();
  }

  function readSharedState() {
    const raw = window.location.hash.replace(/^#/, '');
    if (!raw) return null;
    const match = /(?:^|&)d=([A-Za-z0-9_-]+)/.exec(raw);
    if (!match) return null;
    try {
      return normalizeStateFromShare(JSON.parse(base64UrlDecode(match[1])));
    } catch (err) {
      return null;
    }
  }

  // 分享链接里只带姓名，这里按顺序重新分配 id
  function normalizeStateFromShare(data) {
    if (!data || typeof data !== 'object') return null;
    const next = emptyState();
    const names = Array.isArray(data.p) ? data.p : [];
    const idByName = new Map();

    names.slice(0, MAX_PLAYERS).forEach((raw) => {
      const name = typeof raw === 'string' ? raw.trim().slice(0, 24) : '';
      if (!name || idByName.has(name)) return;
      next.seq.player += 1;
      const pid = `p${next.seq.player}`;
      next.players[pid] = { id: pid, name };
      idByName.set(name, pid);
    });

    const used = new Set();
    const resolve = (raw) => {
      const name = typeof raw === 'string' ? raw.trim().slice(0, 24) : '';
      const pid = idByName.get(name);
      return pid && !used.has(pid) ? pid : null;
    };

    (Array.isArray(data.t) ? data.t : []).slice(0, MAX_TEAMS).forEach((team, index) => {
      if (!team || typeof team !== 'object') return;
      const members = [];
      (Array.isArray(team.p) ? team.p : []).forEach((raw) => {
        const pid = resolve(raw);
        if (pid) {
          used.add(pid);
          members.push(pid);
        }
      });
      next.seq.team += 1;
      next.teams.push({
        id: `t${next.seq.team}`,
        name: (typeof team.n === 'string' && team.n.trim().slice(0, 16)) || `球队${index + 1}`,
        color: /^#[0-9a-fA-F]{6}$/.test(team.c || '') ? String(team.c).toLowerCase() : COLORS[index % COLORS.length],
        players: members,
      });
    });

    (Array.isArray(data.b) ? data.b : []).forEach((raw) => {
      const pid = resolve(raw);
      if (pid) {
        used.add(pid);
        next.pool.push(pid);
      }
    });

    Object.keys(next.players).forEach((pid) => {
      if (!used.has(pid)) {
        used.add(pid);
        next.pool.push(pid);
      }
    });

    if (!next.teams.length) {
      for (let i = 0; i < MIN_TEAMS; i += 1) next.teams.push(makeTeam(next));
    }
    return next;
  }

  function adoptShared() {
    if (!sharedState) return;
    const copy = normalize(JSON.parse(JSON.stringify(sharedState)));
    if (!copy) return;
    state = copy;
    readOnly = false;
    sharedState = null;
    document.body.classList.remove('is-readonly');
    els.viewbar.hidden = true;
    els.teamCount.disabled = false;
    clearShareHash();
    selectedId = null;
    undoStack = [];
    persist();
    render();
    setSaveStatus('ok', '已复制到本机');
    toast('已复制到你的名单，可以继续编辑了');
  }

  function exitPreview() {
    sharedState = null;
    readOnly = false;
    document.body.classList.remove('is-readonly');
    els.viewbar.hidden = true;
    els.teamCount.disabled = false;
    clearShareHash();
    loadLocalState();
    render();
    setSaveStatus('ok', '已存本机');
    toast('已回到你自己的名单');
  }

  function clearShareHash() {
    if (!window.location.hash) return;
    try {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch (err) {
      /* 忽略 */
    }
  }

  function openShareDialog() {
    if (!playerCount()) {
      toast('名单还是空的，没什么可分享的', 'err');
      return;
    }
    const url = buildShareUrl();
    els.shareUrl.value = url;
    const tooLong = url.length > 8000;
    els.shareMeta.textContent = tooLong
      ? `链接有点长（${url.length} 字符），部分聊天软件可能会截断，建议改用「下载备份」。`
      : `链接长度 ${url.length} 字符，直接发给队友即可。`;
    els.shareMeta.classList.toggle('warn', tooLong);
    els.dialogShare.showModal();
    setTimeout(() => {
      els.shareUrl.focus();
      els.shareUrl.select();
    }, 30);
  }

  async function copyShareUrl() {
    const url = els.shareUrl.value;
    try {
      await navigator.clipboard.writeText(url);
      toast('分享链接已复制');
    } catch (err) {
      els.shareUrl.focus();
      els.shareUrl.select();
      const ok = document.execCommand && document.execCommand('copy');
      toast(ok ? '分享链接已复制' : '请手动复制选中的链接', ok ? '' : 'err');
    }
  }

  function downloadBackup() {
    if (!playerCount()) {
      toast('名单还是空的', 'err');
      return;
    }
    const data = {
      app: 'football-draft',
      version: 1,
      exportedAt: new Date().toISOString(),
      state,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `足球分队_备份_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('备份文件已下载');
  }

  function triggerImport() {
    els.importFile.value = '';
    els.importFile.click();
  }

  function handleImport(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const candidate = parsed && parsed.state ? parsed.state : parsed;
        const restored = normalize(candidate);
        if (!restored || !Object.keys(restored.players).length) throw new Error('empty');
        pushUndo();
        state = restored;
        selectedId = null;
        changed();
        toast(`已导入 ${Object.keys(state.players).length} 名球员`);
      } catch (err) {
        toast('这个文件读不出来，请选择本应用导出的备份文件', 'err');
      }
    };
    reader.onerror = () => toast('读取文件失败', 'err');
    reader.readAsText(file, 'utf-8');
  }

  /* ----------------------------------------------------------
     拖拽
     ---------------------------------------------------------- */
  let drag = null;

  function clearTargets() {
    document.querySelectorAll('.is-target').forEach((el) => el.classList.remove('is-target'));
  }

  function zoneAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const zone = el && el.closest('[data-zone]');
    return zone || null;
  }

  function beginDrag(event) {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    if (event.target.closest('.remove')) return;

    const pid = chip.dataset.pid;
    if (!state.players[pid]) return;

    if (readOnly) {
      if (event.pointerType !== 'touch') selectPlayer(pid === selectedId ? null : pid);
      return;
    }

    drag = {
      pid,
      chip,
      pointerId: event.pointerId,
      x0: event.clientX,
      y0: event.clientY,
      x: event.clientX,
      y: event.clientY,
      active: false,
      touch: event.pointerType === 'touch',
      ghost: null,
      zone: null,
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
  }

  function onPointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.x = event.clientX;
    drag.y = event.clientY;

    if (!drag.active) {
      const dx = drag.x - drag.x0;
      const dy = drag.y - drag.y0;
      const distance = Math.hypot(dx, dy);
      const horizontal = Math.abs(dx) > Math.abs(dy) * 1.15;
      const threshold = drag.touch ? 12 : 5;
      if (distance < threshold) return;
      if (drag.touch && !horizontal) {
        // 触屏竖滑交给页面滚动
        endDragListeners();
        drag = null;
        return;
      }
      activateDrag();
    }

    event.preventDefault();
    if (drag.ghost) {
      drag.ghost.style.left = `${drag.x}px`;
      drag.ghost.style.top = `${drag.y}px`;
    }

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

    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.textContent = state.players[drag.pid].name;
    ghost.style.left = `${drag.x}px`;
    ghost.style.top = `${drag.y}px`;
    document.body.appendChild(ghost);
    drag.ghost = ghost;
  }

  function onPointerUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;

    if (drag.active) {
      const zone = zoneAt(drag.x, drag.y);
      const pid = drag.pid;
      endDrag();
      suppressClickUntil = Date.now() + 260;
      if (zone) {
        const dest = zone.dataset.zone;
        if (movePlayer(pid, dest)) {
          const label = dest === 'pool' ? '替补席' : (state.teams.find((t) => t.id === dest) || {}).name || '球队';
          toast(`${state.players[pid].name} → ${label}`);
        }
      }
      return;
    }

    // 没有移动：视为点选
    const pid = drag.pid;
    endDrag();
    selectPlayer(pid === selectedId ? null : pid);
  }

  function onPointerCancel() {
    endDrag();
  }

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
    document.querySelectorAll('.chip.selected').forEach((el) => el.classList.remove('selected'));
    if (pid) {
      document.querySelectorAll(`.chip[data-pid="${CSS.escape(pid)}"]`).forEach((el) => {
        el.classList.add('selected');
      });
    }
  }

  /* ----------------------------------------------------------
     对话框
     ---------------------------------------------------------- */
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
      const onCancel = (event) => { event.preventDefault(); finish(false); };

      els.confirmOk.addEventListener('click', onOk);
      els.dialogConfirm.addEventListener('close', onClose);
      els.dialogConfirm.addEventListener('cancel', onCancel);
      els.dialogConfirm.showModal();
    });
  }

  function openBatchDialog() {
    els.batchText.value = '';
    els.dialogBatch.showModal();
    setTimeout(() => els.batchText.focus(), 30);
  }

  function applyBatch() {
    const text = els.batchText.value;
    const names = text.split(/[\n\r,，、;；\t]+/).map((s) => s.trim()).filter(Boolean);
    els.dialogBatch.close();
    if (!names.length) {
      toast('没有识别到姓名', 'err');
      return;
    }
    addPlayers(names);
  }

  /* ----------------------------------------------------------
     导出
     ---------------------------------------------------------- */
  function exportText() {
    const stamp = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const when = `${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())} ${pad(stamp.getHours())}:${pad(stamp.getMinutes())}`;

    const lines = [];
    lines.push('FOOTBALL DRAFT · 足球分队结果');
    lines.push(`生成时间：${when}`);
    lines.push(`球员总数：${playerCount()}　球队数量：${state.teams.length}`);
    lines.push('');

    state.teams.forEach((team, index) => {
      lines.push(`【${team.name}】 ${team.players.length} 人`);
      if (!team.players.length) {
        lines.push('  （空）');
      } else {
        team.players.forEach((pid, i) => {
          lines.push(`  ${i + 1}. ${state.players[pid] ? state.players[pid].name : pid}`);
        });
      }
      lines.push('');
    });

    lines.push(`【替补席】 ${state.pool.length} 人`);
    if (!state.pool.length) {
      lines.push('  （空）');
    } else {
      state.pool.forEach((pid, i) => {
        lines.push(`  ${i + 1}. ${state.players[pid] ? state.players[pid].name : pid}`);
      });
    }

    return lines.join('\n');
  }

  function exportFile() {
    if (!playerCount()) {
      toast('名单还是空的，没什么可导出的', 'err');
      return;
    }
    const blob = new Blob([exportText()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `足球分队_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('已导出分队名单');
  }

  /* ----------------------------------------------------------
     事件绑定
     ---------------------------------------------------------- */
  function bind() {
    els.playerForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const raw = els.playerInput.value;
      if (!raw.trim()) return;
      const names = raw.split(/[\n\r,，、;；\t]+/).map((s) => s.trim()).filter(Boolean);
      const added = addPlayers(names);
      if (added) els.playerInput.value = '';
    });

    els.search.addEventListener('input', renderRoster);

    els.btnBatch.addEventListener('click', openBatchDialog);
    els.batchOk.addEventListener('click', applyBatch);

    els.btnClearRoster.addEventListener('click', async () => {
      if (!playerCount()) return;
      const ok = await confirmDialog('清空球员名单', '这会删除全部球员和所有分队结果，确定吗？', '清空');
      if (ok) clearRoster();
    });

    els.teamCount.addEventListener('change', () => {
      const value = Number(els.teamCount.value);
      if (!Number.isFinite(value)) {
        els.teamCount.value = String(state.teams.length);
        return;
      }
      setTeamCount(value);
    });

    document.querySelectorAll('.stepper button[data-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const step = Number(btn.dataset.step);
        setTeamCount(state.teams.length + step);
      });
    });

    els.btnShuffle.addEventListener('click', async () => {
      if (!guardEditable()) return;
      if (!playerCount()) {
        toast('名单还是空的，先添加球员', 'err');
        return;
      }
      if (state.pool.length) {
        pushUndo();
        distributePool();
        changed();
        toast('替补球员已随机分入各队');
        return;
      }
      const ok = await confirmDialog('随机重新分队', '所有球员已经分队完毕，要打乱重新分配吗？', '重新分队');
      if (ok) shuffleAll();
    });

    els.btnClearTeams.addEventListener('click', clearTeams);

    els.btnDemo.addEventListener('click', () => {
      addPlayers(DEMO_PLAYERS);
    });

    els.btnUndo.addEventListener('click', undo);
    els.btnExport.addEventListener('click', exportFile);
    els.btnShare.addEventListener('click', openShareDialog);
    els.btnImport.addEventListener('click', triggerImport);
    els.shareCopy.addEventListener('click', copyShareUrl);
    els.shareDownload.addEventListener('click', downloadBackup);
    els.btnAdopt.addEventListener('click', adoptShared);
    els.btnExitView.addEventListener('click', exitPreview);
    els.importFile.addEventListener('change', () => {
      const file = els.importFile.files && els.importFile.files[0];
      if (file) handleImport(file);
    });

    // 对话框里的「取消」按钮
    document.querySelectorAll('dialog [data-close]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dialog = btn.closest('dialog');
        if (dialog) dialog.close();
      });
    });

    els.btnReset.addEventListener('click', async () => {
      if (!guardEditable()) return;
      const ok = await confirmDialog('重置全部数据', '将清空球员名单与所有分队结果，此操作不可恢复（可撤销一次）。', '重置');
      if (!ok) return;
      pushUndo();
      state = emptyState();
      for (let i = 0; i < MIN_TEAMS; i += 1) state.teams.push(makeTeam(state));
      selectedId = null;
      changed();
      toast('已重置');
    });

    // 拖拽：按下 / 抬起
    document.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      if (event.target.closest('input, textarea')) return;
      beginDrag(event);
    });

    // 点击球队/替补席区域 = 放置已选中的球员
    document.addEventListener('click', (event) => {
      if (Date.now() < suppressClickUntil) return;

      const action = event.target.closest('[data-act]');
      if (action) {
        const act = action.dataset.act;
        const pid = action.closest('.chip') ? action.closest('.chip').dataset.pid : null;
        const teamId = action.dataset.team || null;

        if (act === 'delete' && pid) deletePlayer(pid);
        else if (act === 'to-pool' && pid) movePlayer(pid, 'pool');
        else if (act === 'remove-team' && teamId) removeTeam(teamId);
        event.stopPropagation();
        return;
      }

      if (event.target.closest('.chip')) return;
      if (event.target.closest('input, button, .team-name')) return;

      const zone = event.target.closest('[data-zone]');
      if (!zone || !selectedId) return;
      const dest = zone.dataset.zone;
      if (movePlayer(selectedId, dest)) {
        const label = dest === 'pool' ? '替补席' : (state.teams.find((t) => t.id === dest) || {}).name || '球队';
        toast(`${state.players[selectedId] ? state.players[selectedId].name : ''} → ${label}`);
      }
    });

    // 球队改名
    els.teams.addEventListener('change', (event) => {
      const input = event.target.closest('.team-name');
      if (!input) return;
      const team = state.teams.find((t) => t.id === input.dataset.team);
      if (!team) return;
      const name = input.value.trim().slice(0, 16) || `球队${state.teams.indexOf(team) + 1}`;
      if (name === team.name) {
        input.value = team.name;
        return;
      }
      if (!guardEditable()) {
        input.value = team.name;
        return;
      }
      pushUndo();
      team.name = name;
      changed();
    });

    // 键盘：Enter 选中，Esc 取消，Ctrl+Z 撤销
    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        const tag = (event.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        event.preventDefault();
        undo();
        return;
      }

      if (event.key === 'Escape') {
        if (selectedId) {
          selectPlayer(null);
        }
        return;
      }

      const chip = event.target.closest('.chip');
      if (!chip) return;
      if (event.target.closest('.remove')) return;

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const pid = chip.dataset.pid;
        selectPlayer(pid === selectedId ? null : pid);
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        const pid = chip.dataset.pid;
        const loc = locate(pid);
        if (!loc) return;
        event.preventDefault();
        if (loc.type === 'team') movePlayer(pid, 'pool');
        else deletePlayer(pid);
      }
    });

    // 已打开页面时粘贴分享链接（只改 hash 不会重新加载），这里手动接管
    window.addEventListener('hashchange', () => {
      const shared = readSharedState();
      if (!shared || !Object.keys(shared.players).length) return;
      enterReadOnlyPreview(shared);
      render();
      setSaveStatus('ok', '只读预览');
    });

    // 页面关闭 / 切到后台前，把尚未落盘的数据补发一次
    window.addEventListener('pagehide', flushSave);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushSave();
    });
  }

  /* ----------------------------------------------------------
     启动
     ---------------------------------------------------------- */
  function loadLocalState() {
    let loaded = null;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) loaded = JSON.parse(raw);
    } catch (err) {
      /* 无痕模式或数据损坏，忽略 */
    }
    state = normalize(loaded) || emptyState();
    if (!state.teams.length) {
      for (let i = 0; i < MIN_TEAMS; i += 1) state.teams.push(makeTeam(state));
    }
    return Boolean(loaded);
  }

  function enterReadOnlyPreview(shared) {
    sharedState = shared;
    state = normalize(JSON.parse(JSON.stringify(shared)));
    readOnly = true;
    document.body.classList.add('is-readonly');
    els.viewbar.hidden = false;
    els.teamCount.disabled = true;
  }

  function boot() {
    const shared = readSharedState();

    if (shared && Object.keys(shared.players).length) {
      loadLocalState();
      bind();
      enterReadOnlyPreview(shared);
      render();
      setSaveStatus('ok', '只读预览');
      return;
    }

    const hadData = loadLocalState();
    bind();
    render();
    setSaveStatus('ok', hadData ? '已存本机' : '就绪');

    if (!hadData) {
      setTimeout(() => els.playerInput.focus(), 200);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
