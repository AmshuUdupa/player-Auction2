// Global variables
let players = [];
let teams = [];
let currentPlayerIndex = 0;
let currentBid = 0;
const WHATSAPP_PHONE = '919742884585';
let teamPurseTotal = 100;
let soldPlayers = [];
let unsoldPlayers = [];
let pendingNextPlayerTimeout = null;
let currentPlayerSold = false;
let reauctionPrompted = false;

function generateTeamInputs() {
  const teamCount = parseInt(document.getElementById('teamCount').value);
  const container = document.getElementById('teamNamesSection');
  container.innerHTML = '';

  for (let i = 1; i <= teamCount; i++) {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = `Team ${i} Name`;
    input.value = `Team ${i}`;
    input.className = 'team-input';
    input.id = `team${i}`;
    container.appendChild(input);
  }
}

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  document.getElementById('loading').style.display = 'block';

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      if (file.name.endsWith('.csv')) {
        parseCSV(e.target.result);
      } else {
        parseExcel(e.target.result);
      }
    } catch (error) {
      showError('Error reading file: ' + error.message);
    } finally {
      document.getElementById('loading').style.display = 'none';
    }
  };

  if (file.name.endsWith('.csv')) {
    reader.readAsText(file);
  } else {
    reader.readAsArrayBuffer(file);
  }
}

function parseCSV(csvText) {
  const lines = csvText.split('\n');
  players = [];

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      const values = lines[i].split(',').map((v) => v.trim());
      players.push({
        name: values[0] || 'Unknown Player',
        type: values[1] || 'Unknown Type',
        basePrice: parseInt(values[2]) || 0,
      });
    }
  }

  showSuccess(`Successfully loaded ${players.length} players from CSV`);
  updateRemainingPlayersDisplay();
}

function parseExcel(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(firstSheet);

  players = data.map((row) => ({
    name:
      row['Player Name'] ||
      row['player name'] ||
      row['name'] ||
      'Unknown Player',
    type:
      row['Player Type'] ||
      row['player type'] ||
      row['type'] ||
      'Unknown Type',
    basePrice:
      parseInt(row['Base Price'] || row['base price'] || row['price']) || 0,
  }));

  showSuccess(`Successfully loaded ${players.length} players from Excel`);
  updateRemainingPlayersDisplay();
}

function getTeamPurseFromUI() {
  const value = parseInt(document.getElementById('teamPurse').value, 10);
  return value > 0 ? value : 100;
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function startAuction() {
  if (players.length === 0) {
    showError('Please upload a player file first');
    return;
  }

  const randomOrderEnabled = document.getElementById('randomOrderToggle').checked;
  if (randomOrderEnabled) {
    players = shuffleArray(players);
    showSuccess('Players shuffled in random order!');
  }

  const teamCount = parseInt(document.getElementById('teamCount').value);
  teamPurseTotal = getTeamPurseFromUI();
  teams = [];

  for (let i = 1; i <= teamCount; i++) {
    const teamName = document.getElementById(`team${i}`).value || `Team ${i}`;
    teams.push({
      name: teamName,
      purse: teamPurseTotal,
      players: [],
    });
  }

  const soldToSelect = document.getElementById('soldToTeam');
  soldToSelect.innerHTML = '<option value="">Select Team</option>';
  teams.forEach((team, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = team.name;
    soldToSelect.appendChild(option);
  });

  currentPlayerIndex = 0;
  soldPlayers = [];
  unsoldPlayers = [];
  currentPlayerSold = false;
  reauctionPrompted = false;

  document.getElementById('setupSection').style.display = 'none';
  document.getElementById('auctionSection').classList.remove('hidden');
  document.getElementById('headerAuction').classList.remove('hidden');

  displayCurrentPlayer();
  updateTeamsDisplay();
  updateUndoButton();
}

function updateUndoButton() {
  const undoBtn = document.getElementById('undoBtn');
  if (undoBtn) {
    undoBtn.disabled = soldPlayers.length === 0;
  }
}

function getRemainingPlayerCount() {
  const remainingInRound = Math.max(0, players.length - currentPlayerIndex);
  const currentAlreadySold = currentPlayerSold ? 1 : 0;
  return remainingInRound + unsoldPlayers.length - currentAlreadySold;
}

function updateRemainingPlayersDisplay() {
  const remainingEl = document.getElementById('remainingPlayers');
  if (!remainingEl) {
    return;
  }

  const remaining = getRemainingPlayerCount();
  remainingEl.textContent = `Remaining: ${remaining} player${
    remaining === 1 ? '' : 's'
  }`;
}

function displayCurrentPlayer() {
  if (currentPlayerIndex >= players.length) {
    handleRoundComplete();
    return;
  }

  currentPlayerSold = false;
  const player = players[currentPlayerIndex];
  document.getElementById('playerName').textContent = player.name;
  document.getElementById('playerType').textContent = `Type: ${player.type}`;
  document.getElementById(
    'basePrice'
  ).textContent = `Base Price: ${player.basePrice} points`;

  currentBid = player.basePrice;
  document.getElementById(
    'currentBid'
  ).textContent = `Current Bid: ${currentBid} points`;
  updateRemainingPlayersDisplay();
}

function showNoCurrentPlayer(message) {
  document.getElementById('playerName').textContent = message;
  document.getElementById('playerType').textContent = '';
  document.getElementById('basePrice').textContent = '';
  document.getElementById('currentBid').textContent = '';
  updateRemainingPlayersDisplay();
}

function handleRoundComplete() {
  if (unsoldPlayers.length === 0) {
    showNoCurrentPlayer('Auction complete — all players sold');
    showSuccess('Auction completed! All players have been sold.');
    return;
  }

  showNoCurrentPlayer(
    `${unsoldPlayers.length} unsold player(s) remaining`
  );

  if (reauctionPrompted) {
    return;
  }

  reauctionPrompted = true;
  const shouldReauction = confirm(
    `${unsoldPlayers.length} player(s) remain unsold. Re-auction unsold players until everyone is sold?`
  );

  if (shouldReauction) {
    startUnsoldReauction();
  } else {
    reauctionPrompted = false;
    showSuccess(
      `Auction paused with ${unsoldPlayers.length} unsold player(s). Click Next Player to re-auction.`
    );
  }
}

function startUnsoldReauction() {
  if (unsoldPlayers.length === 0) {
    showError('No unsold players to re-auction');
    return;
  }

  players = [...unsoldPlayers];
  unsoldPlayers = [];
  currentPlayerIndex = 0;
  currentPlayerSold = false;
  reauctionPrompted = false;

  const randomOrderEnabled =
    document.getElementById('randomOrderToggle').checked;
  if (randomOrderEnabled) {
    players = shuffleArray(players);
  }

  showSuccess(`Re-auction started with ${players.length} unsold player(s).`);
  displayCurrentPlayer();
}

function nextPlayer() {
  if (currentPlayerIndex >= players.length) {
    handleRoundComplete();
    return;
  }

  const player = players[currentPlayerIndex];
  if (player && !currentPlayerSold) {
    unsoldPlayers.push(player);
  }

  currentPlayerSold = false;
  currentPlayerIndex++;
  displayCurrentPlayer();
}

function nextBid() {
  const increment =
    parseInt(document.getElementById('bidIncrement').value) || 10;
  currentBid += increment;
  document.getElementById(
    'currentBid'
  ).textContent = `Current Bid: ${currentBid} points`;
}

function sellPlayer() {
  const teamIndex = document.getElementById('soldToTeam').value;

  if (currentPlayerIndex >= players.length) {
    showError('No player is currently up for auction');
    return;
  }

  if (teamIndex === '') {
    showError('Please select a team to sell the player to');
    return;
  }

  const team = teams[teamIndex];
  const player = players[currentPlayerIndex];

  if (team.purse < currentBid) {
    showError(
      `${team.name} doesn't have enough points! Available: ${team.purse}, Required: ${currentBid}`
    );
    return;
  }

  playDrumroll();

  currentPlayerSold = true;
  team.purse -= currentBid;

  soldPlayers.push({
    playerName: player.name,
    playerType: player.type,
    bidAmount: currentBid,
    teamName: team.name,
    playerIndex: currentPlayerIndex,
    teamIndex: parseInt(teamIndex, 10),
  });

  team.players.push({
    name: player.name,
    type: player.type,
    price: currentBid,
  });

  showSuccess(
    `${player.name} sold to ${team.name} for ${currentBid} points!`
  );

  sendWhatsAppNotification(player, team, currentBid);

  updateTeamsDisplay();
  updateUndoButton();
  updateRemainingPlayersDisplay();

  if (pendingNextPlayerTimeout) {
    clearTimeout(pendingNextPlayerTimeout);
  }

  pendingNextPlayerTimeout = setTimeout(() => {
    nextPlayer();
    pendingNextPlayerTimeout = null;
  }, 1500);
}

function undoLastSale() {
  if (soldPlayers.length === 0) {
    showError('No sale to undo');
    return;
  }

  const lastSale = soldPlayers.pop();
  const team = teams[lastSale.teamIndex];

  if (!team) {
    showError('Could not undo sale: team not found');
    soldPlayers.push(lastSale);
    updateUndoButton();
    return;
  }

  team.purse += lastSale.bidAmount;

  const playerIndex = team.players.findIndex(
    (p) => p.name === lastSale.playerName && p.price === lastSale.bidAmount
  );
  if (playerIndex !== -1) {
    team.players.splice(playerIndex, 1);
  } else {
    team.players.pop();
  }

  if (pendingNextPlayerTimeout) {
    clearTimeout(pendingNextPlayerTimeout);
    pendingNextPlayerTimeout = null;
  }

  currentPlayerSold = false;
  reauctionPrompted = false;
  currentPlayerIndex = lastSale.playerIndex;
  displayCurrentPlayer();
  updateTeamsDisplay();
  updateUndoButton();

  document.getElementById('soldToTeam').value = '';

  showSuccess(`Undid sale of ${lastSale.playerName} to ${lastSale.teamName}`);
}

function updateTeamsDisplay() {
  const container = document.getElementById('teamsDisplay');
  container.innerHTML = '';

  teams.forEach((team) => {
    const teamDiv = document.createElement('div');
    teamDiv.className = 'team-status';

    const teamHeader = document.createElement('div');
    teamHeader.className = 'team-header';
    teamHeader.innerHTML = `
      <div>
        <div class="team-name">${team.name}</div>
        <small>${team.players.length} players • Spent: ${
      teamPurseTotal - team.purse
    } points</small>
      </div>
      <div class="team-purse">${team.purse} points remaining</div>
    `;

    const playersDiv = document.createElement('div');
    playersDiv.className = 'team-players';

    if (team.players.length === 0) {
      playersDiv.innerHTML =
        '<div class="no-players">No players purchased yet</div>';
    } else {
      team.players.forEach((player) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-item';
        playerDiv.innerHTML = `
          <div class="player-info">
            <div class="player-item-name">${player.name}</div>
            <div class="player-item-type">${player.type}</div>
          </div>
          <div class="player-price">${player.price} pts</div>
        `;
        playersDiv.appendChild(playerDiv);
      });
    }

    teamDiv.appendChild(teamHeader);
    teamDiv.appendChild(playersDiv);
    container.appendChild(teamDiv);
  });
}

function resetAuction() {
  if (
    confirm(
      'Are you sure you want to reset the auction? All progress will be lost.'
    )
  ) {
    currentPlayerIndex = 0;
    soldPlayers = [];
    unsoldPlayers = [];
    currentPlayerSold = false;
    reauctionPrompted = false;
    if (pendingNextPlayerTimeout) {
      clearTimeout(pendingNextPlayerTimeout);
      pendingNextPlayerTimeout = null;
    }
    teams.forEach((team) => {
      team.purse = teamPurseTotal;
      team.players = [];
    });

    document.getElementById('setupSection').style.display = 'block';
    document.getElementById('auctionSection').classList.add('hidden');
    document.getElementById('headerAuction').classList.add('hidden');

    document.getElementById('fileInput').value = '';
    players = [];
    updateRemainingPlayersDisplay();
  }
}

function exportResults() {
  if (soldPlayers.length === 0) {
    showError('No players have been sold yet');
    return;
  }

  const wb = XLSX.utils.book_new();

  const soldPlayersWS = XLSX.utils.json_to_sheet(soldPlayers);
  XLSX.utils.book_append_sheet(wb, soldPlayersWS, 'Sold Players');

  const teamSummary = teams.map((team) => ({
    'Team Name': team.name,
    'Remaining Purse': team.purse,
    'Players Count': team.players.length,
    'Total Spent': teamPurseTotal - team.purse,
  }));
  const teamSummaryWS = XLSX.utils.json_to_sheet(teamSummary);
  XLSX.utils.book_append_sheet(wb, teamSummaryWS, 'Team Summary');

  const unsoldSummary = unsoldPlayers.map((player) => ({
    'Player Name': player.name,
    'Player Type': player.type,
    'Base Price': player.basePrice,
  }));
  const unsoldWS = XLSX.utils.json_to_sheet(unsoldSummary);
  XLSX.utils.book_append_sheet(wb, unsoldWS, 'Unsold Players');

  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  XLSX.writeFile(wb, `auction_results_${timestamp}.xlsx`);

  showSuccess('Auction results exported successfully!');
}

function sendWhatsAppNotification(player, team, bidAmount) {
  if (!document.getElementById('whatsappToggle').checked) {
    return;
  }

  const message =
    `🏏 FLOC Player Auction\n\n` +
    `Player: ${player.name}\n` +
    `Type: ${player.type}\n` +
    `Sold to: ${team.name}\n` +
    `Price: ${bidAmount} points\n` +
    `Remaining purse: ${team.purse} points`;

  const url = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);

  setTimeout(() => {
    errorDiv.remove();
  }, 5000);
}

function showSuccess(message) {
  const successDiv = document.createElement('div');
  successDiv.className = 'success';
  successDiv.textContent = message;
  document.body.appendChild(successDiv);

  setTimeout(() => {
    successDiv.remove();
  }, 3000);
}

function playDrumroll() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioContext.currentTime;
    const drumrollDuration = 0.8;
    const numHits = 12;

    for (let i = 0; i < numHits; i++) {
      const accelerationFactor = Math.pow(0.8, i / numHits);
      const timeInterval = (drumrollDuration / numHits) * accelerationFactor;
      const startTime = now + (i * drumrollDuration) / numHits;

      const oscillator = audioContext.createOscillator();
      const gainEnvelope = audioContext.createGain();

      oscillator.connect(gainEnvelope);
      gainEnvelope.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(120, startTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        80,
        startTime + timeInterval
      );
      oscillator.type = 'sine';

      gainEnvelope.gain.setValueAtTime(0, startTime);
      gainEnvelope.gain.linearRampToValueAtTime(0.35, startTime + 0.008);
      gainEnvelope.gain.exponentialRampToValueAtTime(
        0.01,
        startTime + timeInterval
      );

      oscillator.start(startTime);
      oscillator.stop(startTime + timeInterval);
    }

    const cymbalStartTime = now + drumrollDuration;
    const cymbalOscillator = audioContext.createOscillator();
    const cymbalGain = audioContext.createGain();

    cymbalOscillator.connect(cymbalGain);
    cymbalGain.connect(audioContext.destination);

    cymbalOscillator.frequency.setValueAtTime(12000, cymbalStartTime);
    cymbalOscillator.frequency.exponentialRampToValueAtTime(
      3000,
      cymbalStartTime + 0.5
    );
    cymbalOscillator.type = 'square';

    cymbalGain.gain.setValueAtTime(0.3, cymbalStartTime);
    cymbalGain.gain.exponentialRampToValueAtTime(
      0.01,
      cymbalStartTime + 0.5
    );

    cymbalOscillator.start(cymbalStartTime);
    cymbalOscillator.stop(cymbalStartTime + 0.5);
  } catch (error) {
    console.log('Audio context error:', error);
  }
}

document.addEventListener('DOMContentLoaded', function () {
  document
    .getElementById('teamCount')
    .addEventListener('change', generateTeamInputs);
  document
    .getElementById('fileInput')
    .addEventListener('change', handleFileUpload);
  generateTeamInputs();
  updateRemainingPlayersDisplay();
});
