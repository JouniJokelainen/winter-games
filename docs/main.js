import { renderLeaderboard } from './leaderboard-view.js';
import { loadRemoteConfig } from './peli/core/scoreRepository.js';
import { SupabaseScoreRepository } from './peli/core/supabaseScoreRepository.js';

const root = document.getElementById('leaderboard');

// The shared Supabase board when the site was built with it, else the board file committed from local play.
async function loadBoard() {
  const remote = await loadRemoteConfig();
  if (remote) {
    try {
      return await new SupabaseScoreRepository(remote).getLeaderboard();
    } catch {
      // Fall through to the committed board.
    }
  }
  const response = await fetch('leaderboard.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

loadBoard()
  .then((board) => { root.innerHTML = renderLeaderboard(board); })
  .catch(() => { root.innerHTML = '<p class="empty">TULOKSIA EI VOITU LADATA</p>'; });
