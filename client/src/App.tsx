import React, { useEffect, useState, useRef } from 'react';
import './App.css';
import { socket } from './services/socket';
import type { GameState, Tile, RoomInfo, GameConfig, ChatMessage } from './types';
import { Board } from './components/Board';

type AppView = 'home' | 'rooms' | 'create' | 'lobby' | 'game';

// Map flag emojis to country codes for image URLs
const getFlagUrl = (icon: string) => {
  const flagMap: { [key: string]: string } = {
    '🇬🇷': 'gr', '🇮🇹': 'it', '🇪🇸': 'es', '🇩🇪': 'de',
    '🇨🇳': 'cn', '🇫🇷': 'fr', '🇬🇧': 'gb', '🇺🇸': 'us',
    '🇯🇵': 'jp', '🇰🇷': 'kr', '🇧🇷': 'br', '🇮🇳': 'in',
    '🇦🇺': 'au', '🇨🇦': 'ca', '🇲🇽': 'mx', '🇷🇺': 'ru'
  };
  const code = flagMap[icon];
  return code ? `https://flagcdn.com/w80/${code}.png` : null;
};

// Helper to get currency symbol based on map
const getCurrencySymbol = (mapId: string = 'default') => {
  if (mapId === 'india') return '₹';
  return '$';
};

// Component for Player Row to handle individual money animation state
const PlayerSidebarRow = ({ player, currentPlayerId, currency = '$' }: { player: any, currentPlayerId: string | undefined, currency?: string }) => {
  const [delta, setDelta] = useState<{ val: number, id: number } | null>(null);
  const prevMoney = useRef(player.money);

  useEffect(() => {
    // Debug: console.log(`Money update for ${player.name}: ${prevMoney.current} -> ${player.money}`);
    const diff = player.money - prevMoney.current;
    if (diff !== 0) {
      setDelta({ val: diff, id: Date.now() });
      prevMoney.current = player.money;
      setTimeout(() => setDelta(null), 3000); // 3s duration
    }
  }, [player.money]);

  return (
    <div className={`player-row ${currentPlayerId === player.id ? 'active' : ''} ${player.isBankrupt ? 'bankrupt' : ''} ${player.isDisconnected ? 'disconnected' : ''}`}>
      <div className="player-avatar-circle" style={{ background: player.isDisconnected ? '#555' : player.color, opacity: player.isDisconnected ? 0.5 : 1 }}>
        {/* Status Icons */}
        {player.isDisconnected ? '📡' : (player.isJailed ? '🔒' : (player.vacationTurnsLeft > 0 ? '🏖️' : '😊'))}
      </div>
      <div className="player-details">
        <div className="player-header">
          <span className="player-name-text" style={{ opacity: player.isDisconnected ? 0.5 : 1 }}>{player.name}</span>
          {player.isHost && <span className="crown-icon">👑</span>}
          {player.isDisconnected && <span className="disconnect-badge" title="Player disconnected - waiting to reconnect">⚠️</span>}
        </div>
      </div>
      <div className="player-balance" style={{ position: 'relative', overflow: 'visible', opacity: player.isDisconnected ? 0.5 : 1 }}>
        {currency}{player.money}
        {delta && (
          <span key={delta.id} className={`money-delta ${delta.val > 0 ? 'positive' : 'negative'}`} style={{ zIndex: 999 }}>
            {delta.val > 0 ? '+' : ''}{delta.val}
          </span>
        )}
      </div>
    </div>
  );
};

function App() {
  const [connected, setConnected] = useState(false);
  const [view, setView] = useState<AppView>('home');
  const [playerName, setPlayerName] = useState('');
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const [error, setError] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [config, setConfig] = useState<GameConfig>({
    maxPlayers: 4,
    isPrivate: false,
    startingCash: 1500,
    doubleRentOnMonopoly: true,
    vacationCash: true,
    auctionEnabled: true,
    collectRentInJail: true,
    mortgageEnabled: true,
    evenBuild: true,
    randomizeOrder: true,
    mapId: 'default',
    autoAuction: true,
    reconnectTimeoutSeconds: 60
  });

  const currencySymbol = getCurrencySymbol(gameState?.config.mapId);

  // Player appearance colors
  const PLAYER_COLORS = [
    '#c8ff00', '#d4a017', '#ff8c00', '#e74c3c',
    '#3498db', '#5f9ea0', '#008b8b', '#2ecc71',
    '#8b6508', '#c850c0', '#ff69b4', '#9b59b6'
  ];
  const [selectedColor, setSelectedColor] = useState(PLAYER_COLORS[3]); // Default red
  // Preset Game Pieces




  useEffect(() => {
    socket.connect();
    socket.on('connect', () => {
      setConnected(true);
      // Auto-reconnect: check if we have a saved session
      const savedRoomId = localStorage.getItem('monopoly_roomId');
      const savedPlayerName = localStorage.getItem('monopoly_playerName');
      if (savedRoomId && savedPlayerName) {
        console.log('Attempting to rejoin room:', savedRoomId);
        socket.emit('rejoin_room', { roomId: savedRoomId, playerName: savedPlayerName });
      }
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('rooms_list', (roomsList: RoomInfo[]) => setRooms(roomsList));
    socket.on('room_created', ({ roomId }) => {
      console.log('Room created:', roomId);
      // Save session for reconnection
      localStorage.setItem('monopoly_roomId', roomId);
      localStorage.setItem('monopoly_playerName', playerName);
    });
    socket.on('game_state_update', (state: GameState) => {
      setGameState(state);
      setView(state.gameStarted ? 'game' : 'lobby');
      // Update saved roomId on successful game state
      localStorage.setItem('monopoly_roomId', state.id);
    });
    socket.on('rejoin_success', ({ roomId }) => {
      console.log('Rejoined room:', roomId);
      // roomId is persisted, game_state_update will handle view change
    });
    socket.on('error', (msg: string) => {
      setError(msg);
      // If reconnect failed, clear session
      if (msg.includes('No disconnected player') || msg.includes('Room not found')) {
        localStorage.removeItem('monopoly_roomId');
        localStorage.removeItem('monopoly_playerName');
      }
      setTimeout(() => setError(''), 3000);
    });
    socket.on('new_message', (msg: ChatMessage) => {
      setChatMessages(prev => [...prev, msg]);
      // Scroll to bottom logic could go here or in a separate useEffect
    });
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('rooms_list');
      socket.off('room_created');
      socket.off('game_state_update');
      socket.off('rejoin_success');
      socket.off('error');
      socket.off('new_message');
      socket.disconnect();
    };
  }, []);

  const handlePlay = () => {
    if (!playerName.trim()) { setError('Please enter your name'); return; }
    socket.emit('get_rooms');
    setView('rooms');
  };

  const handleCreateRoom = () => {
    console.log('Creating room with config:', config); // Debug starting money bug
    socket.emit('create_room', { playerName, roomName: roomName || `${playerName}'s Room`, config });
  };

  const handleJoinRoom = (roomId: string) => {
    socket.emit('join_room', { roomId, playerName });
    // Save session for reconnection
    localStorage.setItem('monopoly_roomId', roomId);
    localStorage.setItem('monopoly_playerName', playerName);
  };
  const handleStartGame = () => socket.emit('start_game');
  const handleLeaveRoom = () => {
    socket.emit('leave_room');
    setGameState(null);
    setView('home');
    // Clear session on manual leave
    localStorage.removeItem('monopoly_roomId');
    localStorage.removeItem('monopoly_playerName');
    // Reset trade state
    setTradeTargetId('');
    setTradeOfferMoney(0);
    setTradeRequestMoney(0);
    setTradeOfferProps([]);
    setTradeRequestProps([]);
  };

  const handleJoinByCode = () => {
    if (!joinCode.trim()) { setError('Please enter a room code'); return; }
    handleJoinRoom(joinCode.toUpperCase());
  };

  // Dice animation state
  const [isRolling, setIsRolling] = useState(false);

  // Movement animation state
  const [animatingPlayerId, setAnimatingPlayerId] = useState<string | null>(null);
  const [animationPosition, setAnimationPosition] = useState<number | null>(null);
  const [highlightedTile, setHighlightedTile] = useState<number | null>(null);
  const previousPositions = React.useRef<{ [key: string]: number }>({});

  // Animate player movement step by step
  const animateMovement = (playerId: string, fromPos: number, toPos: number, boardLength: number) => {
    setAnimatingPlayerId(playerId);
    let currentPos = fromPos;
    const steps: number[] = [];

    // Calculate steps (going around the board)
    while (currentPos !== toPos) {
      currentPos = (currentPos + 1) % boardLength;
      steps.push(currentPos);
    }

    // Animate through each step (Faster: 80ms)
    steps.forEach((pos, index) => {
      setTimeout(() => {
        setAnimationPosition(pos);
        setHighlightedTile(pos);
      }, index * 80);
    });

    // Clear animation after completion
    setTimeout(() => {
      setAnimatingPlayerId(null);
      setAnimationPosition(null);
      setHighlightedTile(null);
    }, steps.length * 80 + 100);
  };

  // Jail animation state
  const [showJailAnimation, setShowJailAnimation] = useState(false);
  const [jailedPlayerName, setJailedPlayerName] = useState('');
  const previousJailState = React.useRef<{ [key: string]: boolean }>({});

  // Watch for position changes and trigger animation
  React.useEffect(() => {
    if (!gameState) return;

    gameState.players.forEach(player => {
      const prevPos = previousPositions.current[player.id];
      const wasJailed = previousJailState.current[player.id];

      // Check if player was just sent to jail
      if (!wasJailed && player.isJailed) {
        setJailedPlayerName(player.name);
        setShowJailAnimation(true);
        setTimeout(() => setShowJailAnimation(false), 2000);
      }

      // Normal movement animation (skip if going to jail)
      if (prevPos !== undefined && prevPos !== player.position && !player.isBankrupt && !player.isJailed) {
        animateMovement(player.id, prevPos, player.position, gameState.board.length);
      }

      previousPositions.current[player.id] = player.position;
      previousJailState.current[player.id] = player.isJailed;
    });
  }, [gameState?.players]);

  // Derived state
  const myPlayer = gameState?.players.find(p => p.id === socket.id);

  // Game actions
  const handleRoll = () => {
    setIsRolling(true);
    // Simulating roll time
    setTimeout(() => {
      socket.emit('roll_dice');
      setIsRolling(false);
    }, 1000);
  };

  const handleBuy = () => socket.emit('buy_property');
  const handleDecline = () => socket.emit('decline_property');
  const handleEndTurn = () => socket.emit('end_turn');
  const handleVoluntaryBankrupt = () => {
    if (confirm('Are you sure you want to declare bankruptcy? You will become a spectator.')) {
      socket.emit('voluntary_bankrupt');
    }
  };
  const handlePayJailFine = () => socket.emit('pay_jail_fine');
  const handleUseJailCard = () => socket.emit('use_jail_card');
  const handlePlaceBid = (amount: number) => {
    if (amount > (myPlayer?.money || 0)) return;
    socket.emit('place_bid', amount);
  };
  const handleBuildHouse = (tileId: string) => socket.emit('build_house', tileId);
  const handleSellHouse = (tileId: string) => socket.emit('sell_house', tileId);
  const handleMortgage = (tileId: string) => socket.emit('mortgage_property', tileId);
  const handleUnmortgage = (tileId: string) => socket.emit('unmortgage_property', tileId);
  const handleAcceptTrade = (tradeId: string) => socket.emit('accept_trade', tradeId);
  const handleRejectTrade = (tradeId: string) => socket.emit('reject_trade', tradeId);
  const handleSellProperty = (tileId: string) => {
    if (window.confirm('Are you sure you want to SELL this property to the bank? You will lose ownership.')) {
      socket.emit('sell_property', tileId);
    }
  };

  // Trade modal state
  const [tradeOfferMoney, setTradeOfferMoney] = useState(0);
  const [tradeRequestMoney, setTradeRequestMoney] = useState(0);
  const [tradeOfferProps, setTradeOfferProps] = useState<string[]>([]);
  const [tradeRequestProps, setTradeRequestProps] = useState<string[]>([]);
  const [tradeTargetId, setTradeTargetId] = useState<string>('');
  const [showTradeModal, setShowTradeModal] = useState(false);

  // NEW Trade Refactor State
  const [viewingTradeId, setViewingTradeId] = useState<string | null>(null);
  const [minimizedTradeIds, setMinimizedTradeIds] = useState<string[]>([]);
  const [isNegotiating, setIsNegotiating] = useState(false);

  const [bidAmount, setBidAmount] = useState(0);
  const [auctionTimeLeft, setAuctionTimeLeft] = useState(0);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;
    socket.emit('send_message', chatInput);
    setChatInput('');
  };

  // Auction timer
  useEffect(() => {
    if (gameState?.auction?.isActive) {
      const updateTimer = () => {
        const remaining = Math.max(0, Math.floor((gameState.auction!.endTime - Date.now()) / 1000));
        setAuctionTimeLeft(remaining);

        // Auto-complete auction when timer reaches 0
        if (remaining === 0) {
          socket.emit('complete_auction');
        }
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState?.auction]);

  // NEW: Auto-Auction Logic
  // If it's my turn, I'm on a property, unowned, and I can't afford it -> Auto Decline (start auction)
  useEffect(() => {
    if (!gameState || !myPlayer) return;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.id !== myPlayer.id) return;

    const currentTile = gameState.board[myPlayer.position];
    if (currentTile &&
      ['PROPERTY', 'RAILROAD', 'UTILITY'].includes(currentTile.type) &&
      !currentTile.owner) {

      if ((currentTile.price || 0) > myPlayer.money && gameState.config.autoAuction) {
        // User cannot afford it. Auto-trigger auction.
        // We use a small timeout to let the user see where they landed, then auto-decline
        const timer = setTimeout(() => {
          // Check again to be safe
          if (gameState.players[gameState.currentPlayerIndex].id === myPlayer.id && !gameState.auction?.isActive) {
            handleDecline();
          }
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [gameState?.currentPlayerIndex, gameState?.board, myPlayer?.position, myPlayer?.money]);

  // Auto-open Trade Popup for incoming trades
  useEffect(() => {
    if (!gameState || !myPlayer) return;

    // Find any PENDING trade where I am the target (toPlayerId) OR the sender (fromPlayerId - e.g. if I just sent it, I might want to see it, but usually not. Actually prompt says "user a creates trade... user b clicks negotiate... user a sees popup immediately")
    // So if someone counters me, I am now the "toPlayerId" because counterTrade swaps roles! 
    // Wait, my implementation of counterTrade swaps roles. So the person receiving the counter offer IS the toPlayerId.
    // So simply checking for PENDING trades where I am toPlayerId is sufficient for both initial offers and counter offers.

    const incomingTrades = gameState.trades.filter(t => t.toPlayerId === myPlayer.id && t.status === 'PENDING');

    incomingTrades.forEach(t => {
      // If we are NOT already viewing it AND it is NOT minimized, open it.
      if (viewingTradeId !== t.id && !minimizedTradeIds.includes(t.id)) {
        setViewingTradeId(t.id);
        setIsNegotiating(false); // Default to review mode

        // Populate State for Review
        setTradeTargetId(t.fromPlayerId);
        setTradeOfferProps(t.requestProperties);   // They requested these from ME, so I am "offering" them in my view if I accept? NO.
        // Wait. The state variables are `tradeOfferProps` (My stuff) and `tradeRequestProps` (Their stuff).
        // The Trade Object has:
        // `offerProperties`: Stuff FROM the sender (Them)
        // `requestProperties`: Stuff FROM the receiver (Me)

        // So:
        // My Offer (tradeOfferProps) = Trade.requestProperties (Stuff they want from me)
        // My Request (tradeRequestProps) = Trade.offerProperties (Stuff they are offering me)

        setTradeOfferProps(t.requestProperties);
        setTradeOfferMoney(t.requestMoney);
        setTradeRequestProps(t.offerProperties);
        setTradeRequestMoney(t.offerMoney);

        setShowTradeModal(false); // Ensure create modal is closed
      }
    });

    // Also auto-close if trade is no longer pending (accepted/rejected)
    if (viewingTradeId) {
      const activeTrade = gameState.trades.find(t => t.id === viewingTradeId);
      if (!activeTrade || activeTrade.status !== 'PENDING') {
        setViewingTradeId(null);
        setIsNegotiating(false);
        // Clear state? Maybe not necessary if we close the modal.
      }
    }
  }, [gameState?.trades, myPlayer?.id]);

  // Reset trade target if they leave the game
  useEffect(() => {
    if (gameState && tradeTargetId) {
      const targetExists = gameState.players.some(p => p.id === tradeTargetId);
      if (!targetExists) setTradeTargetId('');
    }
  }, [gameState, tradeTargetId]);



  const handleSendTrade = () => {
    if (!tradeTargetId) return;
    socket.emit('propose_trade', {
      toPlayerId: tradeTargetId,
      offerProperties: tradeOfferProps,
      offerMoney: tradeOfferMoney,
      requestProperties: tradeRequestProps,
      requestMoney: tradeRequestMoney
    });
    setShowTradeModal(false);
    setTradeOfferProps([]);
    setTradeRequestProps([]);
    setTradeOfferMoney(0);
    setTradeRequestMoney(0);
  };

  // HOME PAGE
  if (view === 'home') {
    return (
      <div className="home-page">
        <div className="home-content">
          <div className="dice-logo">🎲</div>
          <h1 className="home-title">
            <span className="rich">POOR</span>
            <span className="up">DOWN</span>
            <span className="io">.OI</span>
          </h1>
          <p className="home-subtitle">Rule the economy</p>

          <div className="name-section">
            <div className="playing-as">
              <span className="avatar">😊</span>
              <span>Playing as</span>
            </div>
            <input
              className="name-input"
              placeholder="Enter your name"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              maxLength={20}
            />
          </div>

          <button className="play-btn" onClick={handlePlay} disabled={!connected}>
            <span className="play-icon">▶▶</span>
            {connected ? 'Play' : 'Connecting...'}
          </button>

          <div className="home-buttons">
            <button className="secondary-btn" onClick={handlePlay}>👥 All rooms</button>
            <button className="secondary-btn" onClick={() => {
              if (!playerName.trim()) { setError('Please enter your name first'); return; }
              setView('create');
            }}>🔑 Create a private game</button>
          </div>
        </div>

        <div className="bg-icons">
          <span className="bg-icon" style={{ top: '10%', left: '5%' }}>🏠</span>
          <span className="bg-icon" style={{ top: '20%', right: '10%' }}>💰</span>
          <span className="bg-icon" style={{ top: '60%', left: '8%' }}>✈️</span>
          <span className="bg-icon" style={{ top: '70%', right: '5%' }}>❓</span>
        </div>
        {error && <div className="error-toast">{error}</div>}
      </div>
    );
  }

  // ROOMS BROWSER
  if (view === 'rooms') {
    return (
      <div className="rooms-page">
        <div className="rooms-container">
          <div className="rooms-header">
            <button className="back-btn" onClick={() => setView('home')}>← Back</button>
            <div className="rooms-title"><h2>Available Rooms</h2></div>
            <button className="refresh-btn" onClick={() => socket.emit('get_rooms')}>🔄 Refresh</button>
          </div>

          {/* Join Hero Section */}
          <div className="join-hero-section">
            <span className="join-label">Have a code?</span>
            <div className="join-input-group">
              <input
                className="join-input"
                placeholder="Enter Room Code (e.g. ABC1234)"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                maxLength={8}
              />
              <button className="join-btn-large" onClick={handleJoinByCode}>JOIN</button>
            </div>
          </div>

          <div className="rooms-grid">
            {/* Card 1: Create New Room */}
            <div className="room-card-base create-room-card" onClick={() => setView('create')}>
              <div className="create-icon-circle">+</div>
              <h3>Create New Room</h3>
            </div>

            {/* Public Rooms */}
            {rooms.map(room => (
              <div key={room.id} className="room-card-base public-room-card" onClick={() => room.playerCount < room.maxPlayers && handleJoinRoom(room.id)}>
                {room.playerCount < room.maxPlayers && <div className="join-overlay"><span className="join-text-btn">Join Game</span></div>}

                <div className="room-card-header">
                  <div>
                    <div className="room-name-large">{room.name}</div>
                    <div className="room-host">HOST: {room.hostName.toUpperCase()}</div>
                  </div>
                  <div className="status-badge" style={{
                    background: room.playerCount >= room.maxPlayers ? 'rgba(231, 76, 60, 0.2)' : 'rgba(46, 204, 113, 0.2)',
                    color: room.playerCount >= room.maxPlayers ? '#e74c3c' : '#2ecc71',
                    padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold'
                  }}>
                    {room.playerCount >= room.maxPlayers ? 'FULL' : 'WAITING'}
                  </div>
                </div>

                <div className="room-occupancy">
                  <div className="occupancy-labels">
                    <span>Players</span>
                    <span>{room.playerCount} / {room.maxPlayers}</span>
                  </div>
                  <div className="progress-track">
                    <div
                      className={`progress-fill ${room.playerCount >= room.maxPlayers ? 'full' : ''}`}
                      style={{ width: `${(room.playerCount / room.maxPlayers) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {rooms.length === 0 && (
            <div style={{ textAlign: 'center', color: '#8a8aa3', marginTop: 20 }}>
              No public rooms found. Create one!
            </div>
          )}
        </div>
        {error && <div className="error-toast">{error}</div>}
      </div>
    );
  }

  // CREATE ROOM
  if (view === 'create') {
    return (
      <div className="create-page">
        <div className="create-header">
          <button className="back-btn" onClick={() => setView('home')}>← Back</button>
          <h2>Create Room</h2>
        </div>

        <div className="create-form">
          <div className="form-group">
            <label>Room Name</label>
            <input value={roomName} onChange={e => setRoomName(e.target.value)} placeholder={`${playerName}'s Room`} />
          </div>

          <h3>Game Settings</h3>



          <div className="form-group">
            <label>Maximum Players</label>
            <select value={config.maxPlayers} onChange={e => setConfig({ ...config, maxPlayers: parseInt(e.target.value) })}>
              <option value={2}>2 Players</option>
              <option value={3}>3 Players</option>
              <option value={4}>4 Players</option>
            </select>
          </div>

          <div className="form-group">
            <label>Starting Cash</label>
            <select value={config.startingCash} onChange={e => setConfig({ ...config, startingCash: parseInt(e.target.value) })}>
              <option value={500}>$500</option>
              <option value={1000}>$1000</option>
              <option value={1500}>$1500 (Standard)</option>
              <option value={2000}>$2000</option>
              <option value={3000}>$3000</option>
            </select>
          </div>

          <div className="form-group">
            <label>Board Map</label>
            <select value={config.mapId} onChange={e => setConfig({ ...config, mapId: e.target.value })}>
              <option value="default">Classic World</option>
              <option value="small">Speed Round</option>
              <option value="india">Indian Economy</option>
            </select>
          </div>

          <div className="toggle-group">
            <label><input type="checkbox" checked={config.isPrivate} onChange={e => setConfig({ ...config, isPrivate: e.target.checked })} /> Private Room</label>
          </div>

          <h3>Gameplay Rules</h3>
          <div className="toggle-group"><label><input type="checkbox" checked={config.doubleRentOnMonopoly} onChange={e => setConfig({ ...config, doubleRentOnMonopoly: e.target.checked })} /> x2 rent on full-set</label></div>
          <div className="toggle-group"><label><input type="checkbox" checked={config.vacationCash} onChange={e => setConfig({ ...config, vacationCash: e.target.checked })} /> Vacation cash</label></div>
          <div className="toggle-group"><label><input type="checkbox" checked={config.autoAuction} onChange={e => setConfig({ ...config, autoAuction: e.target.checked })} /> Auto-start auction if broke</label></div>
          <div className="toggle-group"><label><input type="checkbox" checked={config.auctionEnabled} onChange={e => setConfig({ ...config, auctionEnabled: e.target.checked })} /> Auction skipped properties</label></div>
          <div className="toggle-group"><label><input type="checkbox" checked={config.collectRentInJail} onChange={e => setConfig({ ...config, collectRentInJail: e.target.checked })} /> Collect rent in jail</label></div>
          <div className="toggle-group"><label><input type="checkbox" checked={config.mortgageEnabled} onChange={e => setConfig({ ...config, mortgageEnabled: e.target.checked })} /> Allow mortgage</label></div>
          <div className="toggle-group"><label><input type="checkbox" checked={config.evenBuild} onChange={e => setConfig({ ...config, evenBuild: e.target.checked })} /> Even build rule</label></div>
          <div className="toggle-group"><label><input type="checkbox" checked={config.randomizeOrder} onChange={e => setConfig({ ...config, randomizeOrder: e.target.checked })} /> Randomize order</label></div>

          <button className="create-btn" onClick={handleCreateRoom}>Create Room</button>
        </div>
        {error && <div className="error-toast">{error}</div>}
      </div>
    );
  }

  // LOBBY
  if (view === 'lobby' && gameState) {
    const myPlayer = gameState.players.find(p => p.id === socket.id);
    const isHost = myPlayer?.isHost;
    const canStart = gameState.players.length >= 2;

    return (
      <div className="lobby-page">
        <div className="lobby-header">
          <button className="back-btn" onClick={handleLeaveRoom}>← Leave</button>
          <h2>{gameState.roomName}</h2>
          <span className="room-code">Room: {gameState.id}</span>
        </div>

        <div className="lobby-content">
          {/* Color Selection */}
          <div className="appearance-section">
            <h3>Select your player appearance:</h3>
            <div className="color-grid">
              {PLAYER_COLORS.map(color => {
                const isTaken = gameState.players.some(p => p.id !== socket.id && p.color === color);
                const isSelected = selectedColor === color;
                return (
                  <div
                    key={color}
                    className={`color-option ${isSelected ? 'selected' : ''} ${isTaken ? 'taken' : ''}`}
                    style={{ background: color }}
                    onClick={() => {
                      if (!isTaken) {
                        setSelectedColor(color);
                        socket.emit('change_color', color);
                      }
                    }}
                  >
                    {isSelected && <span className="color-eyes">👀</span>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lobby-players">
            <h3>Players ({gameState.players.length}/{gameState.config.maxPlayers})</h3>
            {gameState.players.map(p => (
              <div key={p.id} className="lobby-player">
                <div className="player-avatar-lg" style={{ background: p.color }}>
                  <span className="avatar-eyes">👀</span>
                </div>
                <span className="player-name">{p.name}</span>
                {p.isHost && <span className="host-badge">HOST</span>}
              </div>
            ))}
            {Array(gameState.config.maxPlayers - gameState.players.length).fill(0).map((_, i) => (
              <div key={`empty-${i}`} className="lobby-player empty">
                <div className="player-avatar-lg">?</div>
                <span className="player-name">Waiting...</span>
              </div>
            ))}
          </div>



          <div className="lobby-actions">
            {isHost ? (
              <button className="start-btn" onClick={handleStartGame} disabled={!canStart}>
                {canStart ? '🚀 Start Game' : 'Waiting for players...'}
              </button>
            ) : (
              <div className="waiting-msg">Waiting for host to start...</div>
            )}
          </div>
        </div>
        {error && <div className="error-toast">{error}</div>}
      </div>
    );
  }

  // GAME VIEW
  if (view === 'game' && gameState) {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    const isMyTurn = myPlayer?.id === currentPlayer?.id;
    const currentTile = myPlayer ? gameState.board[myPlayer.position] : null;

    // Check if we need to show buy actions (landed on unowned property)
    // This blocks rolling/ending turn until resolved.
    const showBuyActions = isMyTurn && currentTile && !currentTile.owner && ['PROPERTY', 'RAILROAD', 'UTILITY'].includes(currentTile.type);
    const canAfford = showBuyActions && myPlayer && currentTile ? myPlayer.money >= (currentTile.price || 0) : false;

    return (
      <div className="app-container">
        {error && <div className="error-toast">{error}</div>}

        {/* 3D Dice Rolling Animation */}
        {isRolling && (
          <div className="dice-overlay">
            <div className="dice-container-3d">
              <div className="dice-3d-emoji rolling-3d">🎲</div>
              <div className="dice-3d-emoji rolling-3d delay">🎲</div>
            </div>
            <div className="roll-text">Rolling...</div>
          </div>
        )}

        {/* Jail Animation Overlay */}
        {showJailAnimation && (
          <div className="jail-animation-overlay">
            <div className="jail-animation-content">
              <div className="jail-icon-big">🚔</div>
              <div className="jail-bars">
                <div className="bar"></div>
                <div className="bar"></div>
                <div className="bar"></div>
                <div className="bar"></div>
              </div>
              <div className="jail-text">GO TO JAIL!</div>
              <div className="jailed-player">{jailedPlayerName}</div>
            </div>
          </div>
        )}

        {/* Property panel is now rendered inside Board component tiles */}

        {/* Winner Modal */}
        {gameState.gameOver && (
          <div className="modal-overlay">
            <div className="modal-content winner-modal" style={{ background: 'linear-gradient(135deg, #1e272e 0%, #000 100%)', border: '1px solid #ffd700', boxShadow: '0 0 50px rgba(255, 215, 0, 0.3)' }}>
              <h1 style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.5)', fontSize: '3rem', margin: '0 0 20px 0' }}>🏆 Game Over!</h1>
              <h2 style={{ color: '#fff', fontSize: '2rem', marginBottom: '40px' }}>
                {gameState.players.find(p => p.id === gameState.winnerId)?.name} Wins!
              </h2>

              <div className="money-graph" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: '200px', width: '100%', gap: '20px', marginBottom: '40px', padding: '0 20px' }}>
                {gameState.players.map(p => {
                  const maxMoney = Math.max(...gameState.players.map(pl => pl.money), 1);
                  const height = Math.max(10, (p.money / maxMoney) * 100);
                  return (
                    <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '60px' }}>
                      <div style={{ color: '#fff', fontWeight: 'bold', marginBottom: '5px' }}>${p.money}</div>
                      <div style={{
                        width: '40px',
                        height: `${height}%`,
                        background: p.color,
                        borderRadius: '4px 4px 0 0',
                        boxShadow: `0 0 10px ${p.color}`,
                        transition: 'height 1s ease-out'
                      }}></div>
                      <div style={{ color: '#fff', fontSize: '0.8rem', marginTop: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>{p.name}</div>
                    </div>
                  );
                })}
              </div>

              <div className="winner-actions" style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                <button className="play-btn" onClick={() => socket.emit('restart_game')} style={{ width: 'auto', padding: '15px 30px', background: '#00b894' }}>
                  🔄 Play Again
                </button>
                <button className="modal-close" onClick={handleLeaveRoom} style={{ width: 'auto', padding: '15px 30px', background: '#636e72' }}>
                  Leave Room
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="sidebar-left">
          <div className="sidebar-header">
            <span className="logo">POORDOWN.OI</span>
            <span className="room-code">Room: {gameState.id}</span>
          </div>
          <div className="chat-section">
            <div className="chat-title">💬 Chat</div>
            <div className="chat-messages">
              {chatMessages.length === 0 ? (
                <div className="chat-message"><span style={{ color: '#8a8aa3' }}>No messages yet...</span></div>
              ) : (
                chatMessages.map(msg => (
                  <div key={msg.id} className="chat-message">
                    <strong style={{ color: msg.color }}>{msg.playerName}: </strong>
                    <span>{msg.text}</span>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSendMessage} style={{ display: 'flex', width: '100%' }}>
              <input
                type="text"
                className="chat-input"
                placeholder="Type a message..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                maxLength={200}
              />
            </form>
          </div>
          {gameState.freeParkingPot > 0 && !gameState.config.vacationCash && <div className="free-parking-pot">🚗 Free Parking: {currencySymbol}{gameState.freeParkingPot}</div>}
        </div>

        <div className="main-stage">
          <Board
            gameState={gameState}
            currentPlayerId={socket.id}
            onTileClick={(tile) => {
              if (selectedTile?.id === tile.id) {
                setSelectedTile(null);
              } else {
                setSelectedTile(tile);
              }
            }}
            highlightedTile={highlightedTile}
            animatingPlayerId={animatingPlayerId}
            animationPosition={animationPosition}
            onRoll={handleRoll}
            onBuy={handleBuy}
            onDecline={handleDecline}
            onEndTurn={handleEndTurn}
            onPayJailFine={handlePayJailFine}
            onUseJailCard={handleUseJailCard}
            isMyTurn={isMyTurn}
            canBuy={!!showBuyActions}
            canAfford={canAfford}
            isRolling={isRolling}
            expandedTile={selectedTile}
            onCloseExpanded={() => setSelectedTile(null)}
            onMortgage={handleMortgage}
            onUnmortgage={handleUnmortgage}
            onBuildHouse={handleBuildHouse}
            onSellHouse={handleSellHouse}
            currency={currencySymbol}
          />
        </div>

        <div className="sidebar-right">
          {/* Players List */}
          <div className="players-list">
            {gameState.players.map(p => {
              // Logic for money delta
              // We need a way to store previous money for each player. 
              // Since we are inside a map, we can't easily stick hooks here without extracting a component.
              // So I will create a mini-component inline or use a ref map in the parent.
              // For simplicity, let's extract a small helper component defined OUTSIDE App first, 
              // OR just use a specialized component here.
              return <PlayerSidebarRow key={p.id} player={p} currentPlayerId={currentPlayer?.id} currency={currencySymbol} />;
            })}
          </div>

          {/* Bankrupt Button Only */}
          <div className="sidebar-actions">
            <button
              className="bankrupt-btn"
              onClick={handleVoluntaryBankrupt}
              disabled={myPlayer?.isBankrupt}
            >
              🚩 Bankrupt
            </button>
          </div>

          {/* Trades Section */}
          <div className="trades-section">
            <div className="trades-header">
              <span className="trades-title">Trades</span>
              <button className="create-trade-btn" onClick={() => setShowTradeModal(true)}>
                <span className="plus-icon">+</span> Create
              </button>
            </div>

            {/* Outgoing Trade Offers (Cancelled) */}
            {gameState.trades.filter(t => t.fromPlayerId === socket.id && t.status === 'PENDING').map(trade => (
              <div key={trade.id} className="trade-offer-card outgoing">
                <p>Waiting for <strong>{gameState.players.find(p => p.id === trade.toPlayerId)?.name}</strong>...</p>
                <button className="reject-trade-btn" onClick={() => socket.emit('cancel_trade', trade.id)} style={{ width: '100%', marginTop: '5px' }}>Cancel Offer</button>
              </div>
            ))}

            {/* Incoming Trade Offers (Compact/Minimized) */}
            {gameState.trades.filter(t => t.toPlayerId === socket.id && t.status === 'PENDING').map(trade => {
              const isMinimized = minimizedTradeIds.includes(trade.id);
              const isViewing = viewingTradeId === trade.id;

              // If it is NOT minimized AND NOT viewing, it should be auto-popped up (so hidden here to avoid duplicate).
              // Wait, if it auto-pops up, `viewingTradeId` IS matched. So `isViewing` is true.
              // So:
              // - Viewing: Show "Viewing..." or Hide? User said "minimize to right side bar".
              // - Minimized: Show Icon.

              if (isViewing) return (
                <div key={trade.id} className="trade-offer-card active-view">
                  <p>👁️ Viewing Trade with <strong>{gameState.players.find(p => p.id === trade.fromPlayerId)?.name}</strong>...</p>
                </div>
              );

              // If minimized (or just waiting in background), show compact bubble
              if (isMinimized) return (
                <div key={trade.id} className="trade-minimized-pill" onClick={() => {
                  setViewingTradeId(trade.id);
                  setMinimizedTradeIds(prev => prev.filter(id => id !== trade.id)); // Un-minimize
                }}>
                  <div className="minimized-avatars">
                    <div className="avatar-small" style={{ background: gameState.players.find(p => p.id === trade.fromPlayerId)?.color }}>😊</div>
                    <span className="arrow">➡️</span>
                    <div className="avatar-small" style={{ background: myPlayer?.color || '#ccc' }}>😊</div>
                  </div>
                  <div className="minimized-label">Trade from {gameState.players.find(p => p.id === trade.fromPlayerId)?.name}</div>
                </div>
              );

              return null;
            })}
          </div>

          {/* My Properties Section */}
          <div className="my-properties-section">
            <h4 className="properties-title">My properties ({myPlayer?.properties.length || 0})</h4>
            <div className="properties-grid" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {myPlayer?.properties.map(propId => {
                const prop = gameState.board.find(t => t.id === propId);
                if (!prop) return null;
                const groupColor = prop.group ? `var(--group-${prop.group})` : '#ccc';
                const flagUrl = prop.icon ? getFlagUrl(prop.icon) : null;

                return (
                  <div
                    key={propId}
                    className="trade-prop-item"
                    style={{
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderLeft: `5px solid ${groupColor.replace('var(--group-', '').replace(')', '')}`, // Fallback if var not resolved, but better to use style
                      borderLeftColor: groupColor,
                      cursor: 'pointer',
                      opacity: 1,
                      padding: '6px 10px',
                      marginBottom: '4px'
                    }}
                    onClick={() => setSelectedTile(prop)}
                  >
                    {flagUrl ? (
                      <div className="item-flag" style={{ backgroundImage: `url(${flagUrl})`, width: '28px', height: '28px', marginRight: '10px' }}></div>
                    ) : (
                      <div className="item-icon" style={{ width: '28px', height: '28px', marginRight: '10px' }}>{prop.icon}</div>
                    )}

                    <div className="item-name" style={{ textAlign: 'left', paddingLeft: '0', fontSize: '0.9rem' }}>{prop.name}</div>

                    {prop.houses > 0 && (
                      <div className="item-price" style={{ color: '#ffd700', minWidth: 'auto', marginLeft: 'auto', fontSize: '0.8rem' }}>
                        {prop.houses === 5 ? '🏨' : `${prop.houses}🏠`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Trade Modal - Unified (Create & Negotiate) */}
        {(showTradeModal || viewingTradeId) && myPlayer && (
          <div className="modal-overlay" onClick={() => {
            // Background click: If reviewing/negotiating, MINIMIZE. If creating, CLOSE.
            if (viewingTradeId) {
              setViewingTradeId(null);
              setMinimizedTradeIds(prev => [...prev, viewingTradeId]);
            } else {
              setShowTradeModal(false);
            }
          }}>
            <div className="trade-modal-richup" onClick={e => e.stopPropagation()}>
              <button className="close-modal-btn" onClick={() => {
                if (viewingTradeId) {
                  setViewingTradeId(null);
                  setMinimizedTradeIds(prev => [...prev, viewingTradeId]);
                } else {
                  setShowTradeModal(false);
                }
              }}>
                {viewingTradeId ? '−' : '×'}
              </button>

              <h2 className="trade-title">
                {viewingTradeId
                  ? (isNegotiating ? 'Negotiating Trade' : 'Incoming Trade Offer')
                  : 'Create a trade'}
              </h2>

              <div className="trade-players-row">
                {/* Your Side */}
                <div className="trade-player-side">
                  <div className="trade-player-info">
                    <div className="trade-avatar" style={{ background: myPlayer.color }}>😊</div>
                    <span className="trade-player-name">{myPlayer.name}</span>
                  </div>
                  <div className="money-slider-container">
                    <input
                      type="range"
                      min="0"
                      max={myPlayer.money}
                      value={tradeOfferMoney}
                      onChange={e => !(!isNegotiating && viewingTradeId) && setTradeOfferMoney(parseInt(e.target.value))}
                      disabled={!!(viewingTradeId && !isNegotiating)}
                      className="money-slider"
                    />
                    <div className="slider-labels">
                      <span>0</span>
                      <span>{myPlayer.money}</span>
                    </div>
                    <div className="money-input-container">
                      <input
                        type="number"
                        min="0"
                        max={myPlayer.money}
                        value={tradeOfferMoney}
                        onChange={e => {
                          if (viewingTradeId && !isNegotiating) return;
                          const val = Math.min(parseInt(e.target.value) || 0, myPlayer.money);
                          setTradeOfferMoney(val);
                        }}
                        disabled={!!(viewingTradeId && !isNegotiating)}
                        className="money-input"
                      />
                      <span className="currency-symbol">{currencySymbol}</span>
                    </div>
                  </div>

                  {/* Properties to offer */}
                  <div className="trade-properties">
                    {myPlayer.properties.filter(id => {
                      const hasNoHouses = gameState.board.find(t => t.id === id)?.houses === 0;
                      if (!hasNoHouses) return false;
                      // Strict filter if viewing trade
                      if (viewingTradeId && !isNegotiating) return tradeOfferProps.includes(id);
                      return true;
                    }).map(propId => {
                      const prop = gameState.board.find(t => t.id === propId);
                      const selected = tradeOfferProps.includes(propId);
                      const flagUrl = prop?.icon ? getFlagUrl(prop.icon) : null;
                      return (
                        <div
                          key={propId}
                          className={`trade-prop-item ${selected ? 'selected' : ''}`}
                          style={{
                            borderColor: `var(--group-${prop?.group})`,
                            opacity: (viewingTradeId && !isNegotiating) ? 0.7 : 1,
                            cursor: (viewingTradeId && !isNegotiating) ? 'default' : 'pointer'
                          }}
                          onClick={() => {
                            if (viewingTradeId && !isNegotiating) return;
                            setTradeOfferProps(selected ? tradeOfferProps.filter(p => p !== propId) : [...tradeOfferProps, propId])
                          }}
                        >
                          {flagUrl ? (
                            <div className="item-flag" style={{ backgroundImage: `url(${flagUrl})` }}></div>
                          ) : (
                            <div className="item-icon">{prop?.icon}</div>
                          )}
                          <div className="item-name">{prop?.name}</div>
                          <div className="item-price">{currencySymbol}{prop?.price}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Trade Arrow */}
                <div className="trade-arrow">↔</div>

                {/* Their Side */}
                <div className="trade-player-side">
                  <div className="trade-player-info">
                    {tradeTargetId ? (
                      <>
                        <div className="trade-avatar" style={{ background: gameState.players.find(p => p.id === tradeTargetId)?.color }}>😊</div>
                        <span className="trade-player-name">{gameState.players.find(p => p.id === tradeTargetId)?.name}</span>
                      </>
                    ) : (
                      <select className="player-select" value={tradeTargetId} onChange={e => setTradeTargetId(e.target.value)}>
                        <option value="">Select player...</option>
                        {gameState.players.filter(p => p.id !== myPlayer.id && !p.isBankrupt).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {tradeTargetId && (
                    <>
                      <div className="money-slider-container">
                        <input
                          type="range"
                          min="0"
                          max={gameState.players.find(p => p.id === tradeTargetId)?.money || 0}
                          value={tradeRequestMoney}
                          onChange={e => !(!isNegotiating && viewingTradeId) && setTradeRequestMoney(parseInt(e.target.value))}
                          disabled={!!(viewingTradeId && !isNegotiating)}
                          className="money-slider"
                        />
                        <div className="slider-labels">
                          <span>0</span>
                          <span>{gameState.players.find(p => p.id === tradeTargetId)?.money}</span>
                        </div>
                        <div className="money-input-container">
                          <input
                            type="number"
                            min="0"
                            max={gameState.players.find(p => p.id === tradeTargetId)?.money || 0}
                            value={tradeRequestMoney}
                            onChange={e => {
                              if (viewingTradeId && !isNegotiating) return;
                              const max = gameState.players.find(p => p.id === tradeTargetId)?.money || 0;
                              const val = Math.min(parseInt(e.target.value) || 0, max);
                              setTradeRequestMoney(val);
                            }}
                            disabled={!!(viewingTradeId && !isNegotiating)}
                            className="money-input"
                          />
                          <span className="currency-symbol">{currencySymbol}</span>
                        </div>
                      </div>

                      {/* Properties to request */}
                      <div className="trade-properties">
                        {gameState.players.find(p => p.id === tradeTargetId)?.properties.filter(id => {
                          const hasNoHouses = gameState.board.find(t => t.id === id)?.houses === 0;
                          if (!hasNoHouses) return false;
                          // Strict filter if viewing trade
                          if (viewingTradeId && !isNegotiating) return tradeRequestProps.includes(id);
                          return true;
                        }).map(propId => {
                          const prop = gameState.board.find(t => t.id === propId);
                          const selected = tradeRequestProps.includes(propId);
                          const flagUrl = prop?.icon ? getFlagUrl(prop.icon) : null;
                          return (
                            <div
                              key={propId}
                              className={`trade-prop-item ${selected ? 'selected' : ''}`}
                              style={{
                                borderColor: `var(--group-${prop?.group})`,
                                opacity: (viewingTradeId && !isNegotiating) ? 0.7 : 1,
                                cursor: (viewingTradeId && !isNegotiating) ? 'default' : 'pointer'
                              }}
                              onClick={() => {
                                if (viewingTradeId && !isNegotiating) return;
                                setTradeRequestProps(selected ? tradeRequestProps.filter(p => p !== propId) : [...tradeRequestProps, propId])
                              }}
                            >
                              {flagUrl ? (
                                <div className="item-flag" style={{ backgroundImage: `url(${flagUrl})` }}></div>
                              ) : (
                                <div className="item-icon">{prop?.icon}</div>
                              )}
                              <div className="item-name">{prop?.name}</div>
                              <div className="item-price">{currencySymbol}{prop?.price}</div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="trade-footer">
                {!viewingTradeId && (
                  <button className="send-trade-btn" onClick={handleSendTrade} disabled={!tradeTargetId}>
                    ✉️ Send trade
                  </button>
                )}

                {viewingTradeId && !isNegotiating && (
                  <>
                    <button className="accept-trade-btn" style={{ flex: 1, marginRight: 5 }} onClick={() => handleAcceptTrade(viewingTradeId)}>✓ Accept</button>
                    <button className="create-trade-btn" style={{ flex: 1, margin: '0 5px', background: '#3498db' }} onClick={() => setIsNegotiating(true)}>💬 Negotiate</button>
                    <button className="reject-trade-btn" style={{ flex: 1, marginLeft: 5 }} onClick={() => handleRejectTrade(viewingTradeId)}>✗ Decline</button>
                  </>
                )}

                {viewingTradeId && isNegotiating && (
                  <>
                    <button className="send-trade-btn" style={{ flex: 1, marginRight: 5 }} onClick={() => {
                      socket.emit('counter_trade', {
                        tradeId: viewingTradeId,
                        offerProperties: tradeOfferProps,
                        offerMoney: tradeOfferMoney,
                        requestProperties: tradeRequestProps,
                        requestMoney: tradeRequestMoney
                      });
                      setViewingTradeId(null); // Close after sending
                      setIsNegotiating(false);
                    }}>
                      ✉️ Send Counter Offer
                    </button>
                    <button className="reject-trade-btn" style={{ flex: 0.5, marginLeft: 5, background: '#7f8c8d' }} onClick={() => setIsNegotiating(false)}>Cancel</button>
                  </>
                )}
              </div>
            </div>

          </div>
        )}

        {/* Auction Modal */}
        {gameState.auction && gameState.auction.isActive && (
          <div className="modal-overlay">
            <div className="auction-modal">
              <div className="auction-header">
                <h2>🔨 Auction: {gameState.auction.tileName}</h2>
                <div className="auction-timer-bar">
                  <div
                    className="auction-timer-fill"
                    style={{
                      width: `${(auctionTimeLeft / 10) * 100}%`,
                      background: auctionTimeLeft < 3 ? '#ff4444' : '#4caf50'
                    }}
                  />
                </div>
              </div>

              <div className="auction-body">
                <div className="current-bid-section">
                  <div className="bid-label">Current Highest Bid</div>
                  <div className="bid-amount">{currencySymbol}{gameState.auction.currentBid}</div>

                  {gameState.auction.highestBidderId ? (
                    <div className="highest-bidder">
                      <div className="player-avatar-circle" style={{
                        background: gameState.players.find(p => p.id === gameState.auction!.highestBidderId)?.color,
                        width: '40px', height: '40px', fontSize: '1.5rem'
                      }}>
                        😊
                      </div>
                      <span>{gameState.auction.highestBidderName}</span>
                    </div>
                  ) : (
                    <div className="no-bids">No bids yet</div>
                  )}
                </div>

                {myPlayer && !myPlayer.isBankrupt && (
                  <div className="bid-controls">
                    <div className="my-money">Your Money: {currencySymbol}{myPlayer.money}</div>

                    {gameState.auction.highestBidderId === myPlayer.id ? (
                      <div className="highest-bidder-status" style={{ textAlign: 'center', color: '#4caf50', fontWeight: 'bold', padding: '10px' }}>
                        You are the highest bidder!
                      </div>
                    ) : (
                      <>
                        <div className="quick-bid-buttons">
                          <button
                            disabled={myPlayer.money < gameState.auction.currentBid + 10}
                            onClick={() => handlePlaceBid(gameState.auction!.currentBid + 10)}
                          >+ {currencySymbol}10</button>
                          <button
                            disabled={myPlayer.money < gameState.auction.currentBid + 50}
                            onClick={() => handlePlaceBid(gameState.auction!.currentBid + 50)}
                          >+ {currencySymbol}50</button>
                          <button
                            disabled={myPlayer.money < gameState.auction.currentBid + 100}
                            onClick={() => handlePlaceBid(gameState.auction!.currentBid + 100)}
                          >+ {currencySymbol}100</button>
                        </div>
                        <div className="custom-bid">
                          <input
                            type="number"
                            placeholder="Custom amount"
                            value={bidAmount}
                            onChange={e => setBidAmount(parseInt(e.target.value))}
                          />
                          <button
                            disabled={!bidAmount || bidAmount <= gameState.auction.currentBid || bidAmount > myPlayer.money}
                            onClick={() => handlePlaceBid(bidAmount)}
                          >Bid</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}


      </div>
    );
  }

  return <div className="home-page"><div className="loading">Loading...</div></div>;
}

// End of App component
export default App;
