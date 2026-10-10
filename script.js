/**
 * TIC TAC TOE - CYBERPUNK NEON EDITION
 * Clean, Modular Vanilla JavaScript Implementation
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // 1. GAME CONSTANTS & STATE
  // ==========================================
  const WINNING_COMBINATIONS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
  ];

  let gameState = {
    board: Array(9).fill(null),
    currentPlayer: 'X',
    isGameOver: false,
    gameMode: 'ai', // 'pvp' or 'ai'
    aiDifficulty: 'hard', // 'easy', 'medium', 'hard'
    starter: 'x', // 'x', 'o', 'alternate'
    lastStarter: 'x',
    scores: { X: 0, O: 0, ties: 0 },
    streak: 0,
    moveHistory: [],
    soundEnabled: true
  };

  // Load saved preferences & scores
  loadLocalStorage();

  // ==========================================
  // 2. DOM ELEMENTS
  // ==========================================
  const boardEl = document.getElementById('board');
  const cells = document.querySelectorAll('.cell');
  const modeSelect = document.getElementById('modeSelect');
  const difficultySelect = document.getElementById('difficultySelect');
  const difficultyGroup = document.getElementById('difficultyGroup');
  const starterSelect = document.getElementById('starterSelect');
  
  const scoreXEl = document.getElementById('scoreX');
  const scoreOEl = document.getElementById('scoreO');
  const scoreTiesEl = document.getElementById('scoreTies');
  const cardX = document.getElementById('cardX');
  const cardO = document.getElementById('cardO');
  const cardTie = document.getElementById('cardTie');
  const nameOEl = document.getElementById('nameO');

  const statusText = document.getElementById('statusText');
  const statusIndicator = document.getElementById('statusIndicator');

  const undoBtn = document.getElementById('undoBtn');
  const restartBtn = document.getElementById('restartBtn');
  const resetScoreBtn = document.getElementById('resetScoreBtn');

  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundOnIcon = soundToggleBtn.querySelector('.sound-on-icon');
  const soundOffIcon = soundToggleBtn.querySelector('.sound-off-icon');

  const resultModal = document.getElementById('resultModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalSubtitle = document.getElementById('modalSubtitle');
  const modalGlowIcon = document.getElementById('modalGlowIcon');
  const statMoves = document.getElementById('statMoves');
  const statStreak = document.getElementById('statStreak');
  const modalPlayAgainBtn = document.getElementById('modalPlayAgainBtn');

  const winningLineSvg = document.getElementById('winningLineSvg');
  const winningLine = document.getElementById('winningLine');
  const confettiCanvas = document.getElementById('confettiCanvas');

  // ==========================================
  // 3. WEB AUDIO SYNTHESIZER
  // ==========================================
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  function playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.1) {
    if (!gameState.soundEnabled) return;
    try {
      initAudio();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      
      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio context policy fallback
    }
  }

  function playClickSound(player) {
    if (player === 'X') {
      playTone(523.25, 'sine', 0.12, 0.15); // C5
    } else {
      playTone(659.25, 'triangle', 0.12, 0.15); // E5
    }
  }

  function playWinSound() {
    if (!gameState.soundEnabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C Major Chord Arpeggio
    notes.forEach((freq, idx) => {
      setTimeout(() => playTone(freq, 'triangle', 0.25, 0.2), idx * 100);
    });
  }

  function playTieSound() {
    if (!gameState.soundEnabled) return;
    const notes = [440, 415.30, 392];
    notes.forEach((freq, idx) => {
      setTimeout(() => playTone(freq, 'sawtooth', 0.15, 0.1), idx * 120);
    });
  }

  function playButtonSound() {
    playTone(300, 'sine', 0.05, 0.05);
  }

  // ==========================================
  // 4. GAME INITIALIZATION & CONTROL
  // ==========================================
  function initGame() {
    // Mode UI setup
    gameState.gameMode = modeSelect.value;
    gameState.aiDifficulty = difficultySelect.value;
    gameState.starter = starterSelect.value;

    if (gameState.gameMode === 'ai') {
      difficultyGroup.classList.remove('hidden');
      nameOEl.textContent = getAiName(gameState.aiDifficulty);
    } else {
      difficultyGroup.classList.add('hidden');
      nameOEl.textContent = 'PLAYER O';
    }

    // Determine starter
    if (gameState.starter === 'alternate') {
      gameState.currentPlayer = gameState.lastStarter === 'X' ? 'O' : 'X';
    } else {
      gameState.currentPlayer = gameState.starter.toUpperCase();
    }
    gameState.lastStarter = gameState.currentPlayer;

    // Reset board state
    gameState.board = Array(9).fill(null);
    gameState.isGameOver = false;
    gameState.moveHistory = [];

    // UI resets
    cells.forEach(cell => {
      cell.innerHTML = '';
      cell.className = 'cell';
      cell.disabled = false;
    });

    hideWinningLine();
    resultModal.classList.add('hidden');
    updateScoreboardUI();
    updateStatusUI();

    undoBtn.disabled = true;

    // If AI goes first
    if (gameState.gameMode === 'ai' && gameState.currentPlayer === 'O') {
      triggerAiMoveWithDelay();
    }
  }

  function getAiName(diff) {
    switch (diff) {
      case 'easy': return 'EASY BOT';
      case 'medium': return 'SMART BOT';
      case 'hard': return 'AI OVERLORD';
      default: return 'AI BOT';
    }
  }

  // ==========================================
  // 5. TURN & MOVE HANDLING
  // ==========================================
  function handleCellClick(e) {
    const index = parseInt(e.target.dataset.index, 10);
    
    if (gameState.board[index] !== null || gameState.isGameOver) return;
    
    // Prevent human click during AI turn
    if (gameState.gameMode === 'ai' && gameState.currentPlayer === 'O') return;

    makeMove(index, gameState.currentPlayer);
  }

  function makeMove(index, player) {
    // Save history for undo
    gameState.moveHistory.push({
      board: [...gameState.board],
      player: gameState.currentPlayer
    });
    undoBtn.disabled = false;

    gameState.board[index] = player;
    renderCell(index, player);
    playClickSound(player);

    const winInfo = checkWinner(gameState.board);

    if (winInfo) {
      endGame(winInfo);
    } else if (isBoardFull(gameState.board)) {
      endGame({ winner: 'tie' });
    } else {
      switchTurn();
    }
  }

  function renderCell(index, player) {
    const cell = cells[index];
    cell.disabled = true;

    if (player === 'X') {
      cell.innerHTML = `
        <svg class="symbol-x" viewBox="0 0 100 100" fill="none" stroke-width="12" stroke-linecap="round">
          <path d="M 25 25 L 75 75 M 75 25 L 25 75" />
        </svg>`;
    } else {
      cell.innerHTML = `
        <svg class="symbol-o" viewBox="0 0 100 100" fill="none" stroke-width="12">
          <circle cx="50" cy="50" r="30" />
        </svg>`;
    }
  }

  function switchTurn() {
    gameState.currentPlayer = gameState.currentPlayer === 'X' ? 'O' : 'X';
    updateStatusUI();
    updateScoreboardUI();

    if (gameState.gameMode === 'ai' && gameState.currentPlayer === 'O' && !gameState.isGameOver) {
      triggerAiMoveWithDelay();
    }
  }

  function triggerAiMoveWithDelay() {
    statusText.textContent = `${nameOEl.textContent} is thinking...`;
    statusIndicator.className = 'status-indicator o-turn';

    setTimeout(() => {
      if (gameState.isGameOver) return;
      const bestMove = computeAiMove();
      if (bestMove !== null && bestMove !== undefined) {
        makeMove(bestMove, 'O');
      }
    }, 450);
  }

  // ==========================================
  // 6. WINNER & END GAME LOGIC
  // ==========================================
  function checkWinner(board) {
    for (const combo of WINNING_COMBINATIONS) {
      const [a, b, c] = combo;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a], combo };
      }
    }
    return null;
  }

  function isBoardFull(board) {
    return board.every(cell => cell !== null);
  }

  function endGame(winInfo) {
    gameState.isGameOver = true;
    undoBtn.disabled = true;
    cells.forEach(c => c.disabled = true);

    if (winInfo.winner === 'tie') {
      gameState.scores.ties++;
      gameState.streak = 0;
      updateScoreboardUI();
      playTieSound();
      showResultModal('ITS A DRAW!', 'Great minds think alike! Perfectly matched.', '🤝', 'tie');
      statusText.textContent = "Game Ended in a Tie!";
    } else {
      const winner = winInfo.winner;
      gameState.scores[winner]++;
      
      if (winner === 'X') {
        gameState.streak++;
      } else {
        gameState.streak = 0;
      }
      
      updateScoreboardUI();
      highlightWinningCombo(winInfo.combo, winner);
      drawWinningLineSVG(winInfo.combo, winner);
      playWinSound();

      const winnerName = winner === 'X' ? 'PLAYER X' : (gameState.gameMode === 'ai' ? nameOEl.textContent : 'PLAYER O');
      
      setTimeout(() => {
        triggerConfetti();
        showResultModal(`${winnerName} WINS!`, 'Dominance established on the grid.', winner === 'X' ? '⚡' : '👑', winner);
      }, 500);

      statusText.textContent = `${winnerName} Victory!`;
    }

    saveLocalStorage();
  }

  function highlightWinningCombo(combo, winner) {
    combo.forEach(idx => {
      cells[idx].classList.add('winner-cell');
      if (winner === 'O') {
        cells[idx].classList.add('winner-o');
      }
    });
  }

  function drawWinningLineSVG(combo, winner) {
    const boardRect = boardEl.getBoundingClientRect();
    const cellA = cells[combo[0]].getBoundingClientRect();
    const cellC = cells[combo[2]].getBoundingClientRect();

    const x1 = cellA.left + cellA.width / 2 - boardRect.left;
    const y1 = cellA.top + cellA.height / 2 - boardRect.top;
    const x2 = cellC.left + cellC.width / 2 - boardRect.left;
    const y2 = cellC.top + cellC.height / 2 - boardRect.top;

    winningLine.setAttribute('x1', x1);
    winningLine.setAttribute('y1', y1);
    winningLine.setAttribute('x2', x2);
    winningLine.setAttribute('y2', y2);

    winningLineSvg.className = `winning-line-svg ${winner === 'O' ? 'line-o' : ''}`;
    winningLine.style.strokeDashoffset = '0';
  }

  function hideWinningLine() {
    winningLine.style.strokeDashoffset = '600';
  }

  function showResultModal(title, subtitle, icon, winner) {
    modalTitle.textContent = title;
    modalSubtitle.textContent = subtitle;
    modalGlowIcon.textContent = icon;

    if (winner === 'X') {
      modalGlowIcon.style.background = 'rgba(0, 243, 255, 0.2)';
      modalGlowIcon.style.boxShadow = '0 0 30px var(--color-x-glow)';
      modalTitle.style.color = 'var(--color-x)';
    } else if (winner === 'O') {
      modalGlowIcon.style.background = 'rgba(255, 0, 127, 0.2)';
      modalGlowIcon.style.boxShadow = '0 0 30px var(--color-o-glow)';
      modalTitle.style.color = 'var(--color-o)';
    } else {
      modalGlowIcon.style.background = 'rgba(255, 183, 3, 0.2)';
      modalGlowIcon.style.boxShadow = '0 0 30px var(--color-tie-glow)';
      modalTitle.style.color = 'var(--color-tie)';
    }

    statMoves.textContent = gameState.moveHistory.length;
    statStreak.textContent = gameState.streak;

    resultModal.classList.remove('hidden');
  }

  // ==========================================
  // 7. UNBEATABLE MINIMAX & AI ALGORITHMS
  // ==========================================
  function computeAiMove() {
    const emptyIndices = gameState.board
      .map((val, idx) => val === null ? idx : null)
      .filter(val => val !== null);

    if (emptyIndices.length === 0) return null;

    if (gameState.aiDifficulty === 'easy') {
      return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    }

    if (gameState.aiDifficulty === 'medium') {
      // 1. Check if AI can win immediately
      for (const idx of emptyIndices) {
        const boardCopy = [...gameState.board];
        boardCopy[idx] = 'O';
        if (checkWinner(boardCopy)?.winner === 'O') return idx;
      }
      // 2. Check if AI needs to block player win
      for (const idx of emptyIndices) {
        const boardCopy = [...gameState.board];
        boardCopy[idx] = 'X';
        if (checkWinner(boardCopy)?.winner === 'X') return idx;
      }
      // 3. Pick center if open
      if (gameState.board[4] === null && Math.random() > 0.3) return 4;

      // 4. Random fallback
      return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    }

    // Hard Level (Unbeatable Minimax)
    return getMinimaxBestMove(gameState.board);
  }

  function getMinimaxBestMove(board) {
    let bestScore = -Infinity;
    let bestMove = null;

    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = 'O';
        let score = minimax(board, 0, false, -Infinity, Infinity);
        board[i] = null;
        if (score > bestScore) {
          bestScore = score;
          bestMove = i;
        }
      }
    }
    return bestMove;
  }

  function minimax(board, depth, isMaximizing, alpha, beta) {
    const winInfo = checkWinner(board);
    if (winInfo?.winner === 'O') return 10 - depth;
    if (winInfo?.winner === 'X') return depth - 10;
    if (isBoardFull(board)) return 0;

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (board[i] === null) {
          board[i] = 'O';
          let evaluation = minimax(board, depth + 1, false, alpha, beta);
          board[i] = null;
          maxEval = Math.max(maxEval, evaluation);
          alpha = Math.max(alpha, evaluation);
          if (beta <= alpha) break; // Alpha-beta pruning
        }
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (let i = 0; i < 9; i++) {
        if (board[i] === null) {
          board[i] = 'X';
          let evaluation = minimax(board, depth + 1, true, alpha, beta);
          board[i] = null;
          minEval = Math.min(minEval, evaluation);
          beta = Math.min(beta, evaluation);
          if (beta <= alpha) break;
        }
      }
      return minEval;
    }
  }

  // ==========================================
  // 8. UNDO & SCORE MANAGERS
  // ==========================================
  function undoMove() {
    if (gameState.moveHistory.length === 0 || gameState.isGameOver) return;
    playButtonSound();

    let stepsToUndo = 1;
    // In AI mode, undo both AI move and Player move
    if (gameState.gameMode === 'ai' && gameState.moveHistory.length >= 2) {
      stepsToUndo = 2;
    }

    for (let i = 0; i < stepsToUndo; i++) {
      if (gameState.moveHistory.length > 0) {
        const lastState = gameState.moveHistory.pop();
        gameState.board = lastState.board;
        gameState.currentPlayer = lastState.player;
      }
    }

    // Re-render board
    cells.forEach((cell, idx) => {
      const val = gameState.board[idx];
      cell.className = 'cell';
      if (val) {
        renderCell(idx, val);
      } else {
        cell.innerHTML = '';
        cell.disabled = false;
      }
    });

    hideWinningLine();
    updateStatusUI();
    updateScoreboardUI();

    undoBtn.disabled = gameState.moveHistory.length === 0;
  }

  function resetScores() {
    playButtonSound();
    gameState.scores = { X: 0, O: 0, ties: 0 };
    gameState.streak = 0;
    updateScoreboardUI();
    saveLocalStorage();
  }

  // ==========================================
  // 9. UI UPDATERS
  // ==========================================
  function updateScoreboardUI() {
    scoreXEl.textContent = gameState.scores.X;
    scoreOEl.textContent = gameState.scores.O;
    scoreTiesEl.textContent = gameState.scores.ties;

    cardX.classList.toggle('active-turn', gameState.currentPlayer === 'X' && !gameState.isGameOver);
    cardO.classList.toggle('active-turn', gameState.currentPlayer === 'O' && !gameState.isGameOver);
  }

  function updateStatusUI() {
    if (gameState.isGameOver) return;

    if (gameState.currentPlayer === 'X') {
      statusText.textContent = "Player X's Turn";
      statusIndicator.className = 'status-indicator';
    } else {
      const name = gameState.gameMode === 'ai' ? nameOEl.textContent : "Player O";
      statusText.textContent = `${name}'s Turn`;
      statusIndicator.className = 'status-indicator o-turn';
    }
  }

  // ==========================================
  // 10. CANVASES & CONFETTI SYSTEM
  // ==========================================
  function triggerConfetti() {
    const ctx = confettiCanvas.getContext('2d');
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#00f3ff', '#ff007f', '#ffb703', '#ffffff', '#7000ff'];

    for (let i = 0; i < 90; i++) {
      particles.push({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 0.8) * 16,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 10,
        opacity: 1
      });
    }

    let animId;
    function render() {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      let alive = false;

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35; // gravity
        p.rotation += p.vRot;
        p.opacity -= 0.012;

        if (p.opacity > 0) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = p.opacity;
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
      });

      if (alive) {
        animId = requestAnimationFrame(render);
      } else {
        cancelAnimationFrame(animId);
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      }
    }

    render();
  }

  // ==========================================
  // 11. LOCAL STORAGE PERSISTENCE
  // ==========================================
  function saveLocalStorage() {
    try {
      localStorage.setItem('tictactoe_scores', JSON.stringify(gameState.scores));
      localStorage.setItem('tictactoe_sound', gameState.soundEnabled);
    } catch (e) {}
  }

  function loadLocalStorage() {
    try {
      const savedScores = localStorage.getItem('tictactoe_scores');
      if (savedScores) gameState.scores = JSON.parse(savedScores);

      const savedSound = localStorage.getItem('tictactoe_sound');
      if (savedSound !== null) gameState.soundEnabled = savedSound === 'true';
    } catch (e) {}
  }

  // ==========================================
  // 12. EVENT LISTENERS & KEYBOARD NAV
  // ==========================================
  cells.forEach(cell => cell.addEventListener('click', handleCellClick));

  modeSelect.addEventListener('change', () => { playButtonSound(); initGame(); });
  difficultySelect.addEventListener('change', () => { playButtonSound(); initGame(); });
  starterSelect.addEventListener('change', () => { playButtonSound(); initGame(); });

  restartBtn.addEventListener('click', () => { playButtonSound(); initGame(); });
  modalPlayAgainBtn.addEventListener('click', () => { playButtonSound(); initGame(); });
  undoBtn.addEventListener('click', undoMove);
  resetScoreBtn.addEventListener('click', resetScores);

  soundToggleBtn.addEventListener('click', () => {
    gameState.soundEnabled = !gameState.soundEnabled;
    soundOnIcon.classList.toggle('hidden', !gameState.soundEnabled);
    soundOffIcon.classList.toggle('hidden', gameState.soundEnabled);
    playButtonSound();
    saveLocalStorage();
  });

  // Theme effect toggle
  document.getElementById('themeToggleBtn').addEventListener('click', () => {
    document.body.classList.toggle('alt-theme');
    playButtonSound();
  });

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Keys 1-9 for grid cells
    if (e.key >= '1' && e.key <= '9') {
      const idx = parseInt(e.key, 10) - 1;
      cells[idx].click();
    } else if (e.key.toLowerCase() === 'r') {
      initGame();
    } else if (e.key.toLowerCase() === 'u') {
      undoMove();
    } else if (e.key === 'Escape') {
      resultModal.classList.add('hidden');
    }
  });

  // Start initial game
  initGame();
});
