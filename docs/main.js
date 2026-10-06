import { renderLeaderboard } from './leaderboard-view.js';

const root = document.getElementById('leaderboard');

fetch('leaderboard.json', { cache: 'no-store' })
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((board) => { root.innerHTML = renderLeaderboard(board); })
  .catch(() => { root.innerHTML = '<p class="empty">TULOKSIA EI VOITU LADATA</p>'; });
