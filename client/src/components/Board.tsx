import React from 'react';
import type { GameState, Tile } from '../types';
import './Board.css';

interface BoardProps {
  gameState: GameState;
  currentPlayerId?: string;
  onTileClick?: (tile: Tile) => void;
  highlightedTile?: number | null;
  animatingPlayerId?: string | null;
  animationPosition?: number | null;
  // Action handlers
  onRoll?: () => void;
  onBuy?: () => void;
  onDecline?: () => void;
  onEndTurn?: () => void;
  onPayJailFine?: () => void;
  onUseJailCard?: () => void;
  isMyTurn?: boolean;
  canBuy?: boolean; // Now means "Show Buy Actions"
  canAfford?: boolean;
  isRolling?: boolean;
  // Property Expansion & Management
  expandedTile?: Tile | null;
  onCloseExpanded?: () => void;
  onMortgage?: (tileId: string) => void;
  onUnmortgage?: (tileId: string) => void;
  onBuildHouse?: (tileId: string) => void;
  onSellHouse?: (tileId: string) => void;
  onSellProperty?: (tileId: string) => void;
}

// Calculate estimated tax based on player's money
const calculateTax = (playerMoney: number, tileId?: string): { amount: number; rate: string } => {
  if (tileId === 'luxury_tax') {
    return { amount: 75, rate: 'Flat' };
  }

  let taxRate: number;
  let rateName: string;

  if (playerMoney < 500) {
    taxRate = 0.05;
    rateName = '5%';
  } else if (playerMoney < 1000) {
    taxRate = 0.10;
    rateName = '10%';
  } else if (playerMoney < 2000) {
    taxRate = 0.15;
    rateName = '15%';
  } else {
    taxRate = 0.20;
    rateName = '20%';
  }

  const tax = Math.max(Math.floor(playerMoney * taxRate), 50);
  return { amount: tax, rate: rateName };

};


export const Board: React.FC<BoardProps> = ({
  gameState, currentPlayerId, onTileClick, highlightedTile, animatingPlayerId, animationPosition,
  onRoll, onBuy, onDecline, onEndTurn, onPayJailFine, onUseJailCard, isMyTurn, canBuy, canAfford, isRolling,
  expandedTile, onCloseExpanded, onMortgage, onUnmortgage, onBuildHouse, onSellHouse, onSellProperty
}) => {
  const { board, players } = gameState;
  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const myPlayer = currentPlayer;

  // Calculate board layout
  const total = board.length;
  const sideCount = (total - 4) / 4;

  // Corner indices
  const goIdx = 0;
  const jailIdx = sideCount + 1;
  const fpIdx = 2 * sideCount + 2;
  const gtjIdx = 3 * sideCount + 3;

  // Side slices
  const bottomTiles = board.slice(1, jailIdx);
  const leftTiles = board.slice(jailIdx + 1, fpIdx);
  const topTiles = board.slice(fpIdx + 1, gtjIdx);
  const rightTiles = board.slice(gtjIdx + 1, total);

  const renderHouses = (houses: number) => {
    if (houses === 0) return null;
    if (houses === 5) return <div className="hotel-icon">🏨</div>;
    // Show concise house count if more than 1, or just 1 icon if 1
    return (
      <div className="houses-concise">
        {houses > 1 ? <span className="house-count">{houses}x</span> : null}
        <span className="house-icon">🏠</span>
      </div>
    );
  };

  const renderTile = (tile: Tile, side: 'bottom' | 'left' | 'top' | 'right') => {
    if (!tile) return null;
    const tileIndex = board.indexOf(tile);
    const playersOnTile = players.filter(p => p.position === tileIndex && !p.isBankrupt);
    const owner = tile.owner ? players.find(p => p.id === tile.owner) : null;
    const isHighlighted = highlightedTile === tileIndex;

    // Check if this tile's panel is open
    const isPanelOpen = expandedTile?.id === tile.id;

    // Determine panel expand direction based on side
    const getExpandDirection = () => {
      switch (side) {
        case 'bottom': return 'expand-up';
        case 'top': return 'expand-down';
        case 'left': return 'expand-right';
        case 'right': return 'expand-left';
        default: return 'expand-up';
      }
    };

    // Show animated player token during animation  
    const animatingPlayer = animatingPlayerId && animationPosition === tileIndex
      ? players.find(p => p.id === animatingPlayerId)
      : null;

    // Check for monopoly (full group ownership)
    const isMonopoly = tile.group && tile.owner && board.filter(t => t.group === tile.group).every(t => t.owner === tile.owner);

    // Base style checks
    const tileStyle = tile.group ? {
      boxShadow: `inset 0 0 20px rgba(0,0,0,0.3)`
    } : {};

    // Additional styling for monopoly glow (border only)
    // Additional styling for monopoly glow (border only)
    const additionalClasses = `tile-${tile.id} type-${tile.type} ${tile.isMortgaged ? 'mortgaged' : ''} ${owner ? 'owned' : ''} ${isHighlighted ? 'highlighted' : ''} ${isMonopoly ? 'monopoly-glow' : ''} ${isPanelOpen ? 'panel-active' : ''}`;

    // Monopoly glow effect style (applied to outer div)
    const glowStyle = isMonopoly ? {
      boxShadow: `0 0 15px ${owner?.color}, 0 0 30px ${owner?.color}`,
      zIndex: 15,
      animation: 'pulse-glow 1.5s ease-out 1'
    } : {};

    // Map flag emojis
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

    const flagUrl = tile.icon ? getFlagUrl(tile.icon) : null;

    // Disable click for non-interactive tiles
    const isInteractive = ['PROPERTY', 'RAILROAD', 'UTILITY', 'TAX'].includes(tile.type);

    return (
      <div
        key={tile.id}
        className={`tile-base side-${side} ${additionalClasses}`}
        onClick={(e) => {
          e.stopPropagation();
          isInteractive && onTileClick?.(tile);
        }}
        style={{ ...tileStyle, ...glowStyle, cursor: isInteractive ? 'pointer' : 'default' }}
      >
        <div className="tile-content">
          {flagUrl ? (
            <div className="tile-flag">
              <img src={flagUrl} alt="" />
            </div>
          ) : tile.icon && (
            <div className="tile-icon">{tile.icon}</div>
          )}
          <div className="tile-name">{tile.name}</div>

          {/* Show dynamic tax for TAX tiles */}
          {tile.type === 'TAX' && currentPlayer && (
            <div className="tile-price tax-price">
              {calculateTax(currentPlayer.money, tile.id).rate} (${calculateTax(currentPlayer.money, tile.id).amount})
            </div>
          )}

          {tile.isMortgaged && (
            <div className="mortgage-overlay">
              <span className="mortgage-icon">💸</span>
            </div>
          )}

          {/* Price Bar / Owner Bar logic */}
          {tile.type !== 'TAX' && tile.price !== undefined && !tile.isMortgaged && (
            <div
              className="tile-price-bar"
              style={{
                background: owner ? owner.color : 'rgba(0,0,0,0.5)',
                color: owner ? '#fff' : '#fff'
              }}
            >
              {owner ? (
                // Owned: Show house count if > 0, otherwise nothing (just colored bar)
                tile.houses > 0 ? renderHouses(tile.houses) : null
              ) : (
                // Unowned: Show Price
                `$${tile.price}`
              )}
            </div>
          )}
        </div>

        {/* Render houses on top of tile content if needed, but we put them in bar now. 
            Legacy call removed. */}

        {/* Animated player token */}
        {animatingPlayer && (
          <div className="token-container animated-token">
            <div className="token pulse-token" style={{ background: animatingPlayer.color }}>👀</div>
          </div>
        )}

        {/* Regular player tokens */}
        {playersOnTile.length > 0 && !animatingPlayer && (
          <div className="token-container">
            {playersOnTile.map(p => (
              <div key={p.id} className="token" style={{ background: p.color }} title={p.name}>
                {p.isJailed ? '🔒' : '👀'}
              </div>
            ))}
          </div>
        )}

        {/* COLLAPSIBLE PROPERTY PANEL */}
        {isPanelOpen && tile.type !== 'TAX' && (
          <div
            className={`tile-property-panel ${getExpandDirection()}`}
            onClick={(e) => {
              e.stopPropagation();
              // User wants: "click again on the panel... it disappears"
              onCloseExpanded?.();
            }}
          >
            {/* Close button removed as per request */}

            <div className="panel-header" style={{ background: tile.group ? `var(--group-${tile.group})` : '#444' }}>
              {tile.name}
            </div>

            <div className="panel-body">
              {tile.isMortgaged && (
                <div className="panel-mortgage-badge">⚠️ MORTGAGED</div>
              )}

              {/* Property rent with houses */}
              {tile.rent && tile.type === 'PROPERTY' && (
                <>
                  <div className="panel-rent-row"><span>Rent</span><span>${tile.rent[0]}</span></div>
                  <div className="panel-rent-row"><span>1 House</span><span>${tile.rent[1]}</span></div>
                  <div className="panel-rent-row"><span>2 Houses</span><span>${tile.rent[2]}</span></div>
                  <div className="panel-rent-row"><span>3 Houses</span><span>${tile.rent[3]}</span></div>
                  <div className="panel-rent-row"><span>4 Houses</span><span>${tile.rent[4]}</span></div>
                  <div className="panel-rent-row"><span>Hotel</span><span>${tile.rent[5]}</span></div>
                </>
              )}

              {/* Railroad/Airport rent */}
              {tile.type === 'RAILROAD' && (
                <>
                  <div className="panel-rent-row"><span>1 Airport</span><span>$25</span></div>
                  <div className="panel-rent-row"><span>2 Airports</span><span>$50</span></div>
                  <div className="panel-rent-row"><span>3 Airports</span><span>$100</span></div>
                  <div className="panel-rent-row"><span>4 Airports</span><span>$200</span></div>
                </>
              )}

              {/* Utility rent */}
              {tile.type === 'UTILITY' && (
                <div style={{ textAlign: 'center', padding: '10px', color: '#888' }}>
                  Rent = Dice × 4 (or ×10 if both owned)
                </div>
              )}
            </div>

            <div className="panel-footer">
              <div className="panel-stat"><span className="panel-stat-icon">💰</span> ${tile.price}</div>
              {tile.houseCost && <div className="panel-stat"><span className="panel-stat-icon">🏠</span> ${tile.houseCost}</div>}
            </div>

            {/* Owner Actions */}
            {myPlayer?.id === tile.owner && isMyTurn && (
              <div className="panel-actions">
                {!tile.isMortgaged && tile.houses < 5 && (
                  <button className="panel-action-btn build" onClick={(e) => { e.stopPropagation(); onBuildHouse?.(tile.id); }}>
                    🏠+
                  </button>
                )}
                {tile.houses > 0 && (
                  <button className="panel-action-btn sell" onClick={(e) => { e.stopPropagation(); onSellHouse?.(tile.id); }}>
                    🏠-
                  </button>
                )}
                {!tile.isMortgaged && tile.houses === 0 && (
                  <button className="panel-action-btn mortgage" onClick={(e) => { e.stopPropagation(); onMortgage?.(tile.id); }}>
                    📥 Mortgage
                  </button>
                )}
                {tile.isMortgaged && (
                  <button className="panel-action-btn unmortgage" onClick={(e) => { e.stopPropagation(); onUnmortgage?.(tile.id); }}>
                    🔄 Unmortgage
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCorner = (tile: Tile | undefined, position: string) => {
    if (!tile) return <div className={`corner corner-${position}`}></div>;

    const tileIndex = board.indexOf(tile);
    const playersOnTile = players.filter(p => p.position === tileIndex && !p.isBankrupt);

    return (
      <div className={`corner corner-${position}`} onClick={() => onTileClick?.(tile)}>
        <div className="corner-content">
          <div className="corner-icon">{tile.icon}</div>
          <div className="corner-name">{tile.name}</div>
          {tile.type === 'FREE_PARKING' && gameState.config.vacationCash && myPlayer && myPlayer.vacationFund > 0 && (
            <div style={{ fontSize: '0.7rem', color: '#00b894', fontWeight: 'bold', marginTop: '2px', background: 'rgba(0,0,0,0.5)', padding: '2px 4px', borderRadius: '4px' }}>
              ${myPlayer.vacationFund}
            </div>
          )}
        </div>
        {playersOnTile.length > 0 && (
          <div className="token-container">
            {playersOnTile.map(p => (
              <div key={p.id} className="token" style={{ background: p.color }}>
                {p.isJailed && tile.type === 'JAIL' ? '🔒' : '👀'}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="board-wrapper">
      <div className="monopoly-board-container">
        {/* Corners */}
        {renderCorner(board[goIdx], 'br')}
        {renderCorner(board[jailIdx], 'bl')}
        {renderCorner(board[fpIdx], 'tl')}
        {renderCorner(board[gtjIdx], 'tr')}

        {/* Tile Strips */}
        <div className="board-row-bottom">
          {bottomTiles.map(t => renderTile(t, 'bottom'))}
        </div>
        <div className="board-col-left">
          {leftTiles.map(t => renderTile(t, 'left'))}
        </div>
        <div className="board-row-top">
          {topTiles.map(t => renderTile(t, 'top'))}
        </div>
        <div className="board-col-right">
          {rightTiles.map(t => renderTile(t, 'right'))}
        </div>

        {/* Center */}
        <div className="board-center" onClick={() => {
          if (expandedTile && onCloseExpanded) {
            // Clicking background closes it
            onCloseExpanded();
          }
        }}>
          {/* Default Center Content - property panel is now rendered on tiles */}
          <div className="turn-indicator">
            <span className="player-name-highlight">{currentPlayer?.name || 'Player'}</span> is playing...
          </div>

          {/* Keep Logs and Dice visible if NO property Expanded, OR maybe overlay property on top? 
              The task said "expand to center". If I replace content, I lose dice visibility. 
              But usually looking at property details is a focused action.
              I'll render logs/dice ONLY if !expandedTile for cleanliness.
          */}

          {/* KEEP CENTER CONTENT VISIBLE AUTOMATICALLY */}
          {/* If expandedTile exists, it renders ON TOP via z-index. */}

          {gameState.dice && gameState.dice[0] > 0 && (
            <div className="dice-container">
              <div className="die">{gameState.dice[0]}</div>
              <div className="die">{gameState.dice[1]}</div>
            </div>
          )}

          {gameState.doublesCount > 0 && (
            <div className="doubles-indicator">
              🎲 Doubles! ({gameState.doublesCount})
            </div>
          )}

          {/* Action Log in Center */}
          <div className="action-log-center">
            <div className="action-log-header">📜 Game Log</div>
            <div className="action-log-content">
              {gameState.actionLog.slice(0, 8).map((log, i) => (
                <div key={i} className="action-log-entry">{log}</div>
              ))}
            </div>
          </div>

          {/* Action Buttons Below Game Log */}
          {isMyTurn && (
            <div className="board-actions">
              {/* Roll Dice / Jail Options */}
              {myPlayer?.isJailed ? (
                <div className="jail-options">
                  <button className="action-btn jail-btn" onClick={onPayJailFine}>
                    💰 Pay $50 Fine
                  </button>
                  {myPlayer.getOutOfJailCards > 0 && (
                    <button className="action-btn jail-btn" onClick={onUseJailCard}>
                      🎫 Use Card
                    </button>
                  )}
                  <button className="action-btn roll-btn" onClick={onRoll} disabled={isRolling}>
                    🎲 Roll for Doubles
                  </button>
                </div>
              ) : (
                <>
                  {(gameState.mustRoll || (gameState.canRollAgain && !canBuy)) && (
                    <button className="action-btn roll-btn" onClick={onRoll} disabled={isRolling}>
                      {isRolling ? '🎲 Rolling...' : gameState.canRollAgain ? '🎲 Roll Again!' : '🎲 Roll Dice'}
                    </button>
                  )}
                  {/* Wait for animation to finish before showing buy options */}
                  {canBuy && !animatingPlayerId && (
                    <div className="buy-options">
                      <button
                        className="action-btn buy-btn"
                        onClick={onBuy}
                        disabled={!canAfford}
                        style={{ opacity: canAfford ? 1 : 0.5, cursor: canAfford ? 'pointer' : 'not-allowed' }}
                      >
                        ✓ Buy
                      </button>
                      <button className="action-btn auction-btn" onClick={onDecline}>🔨 Auction</button>
                    </div>
                  )}
                  {!gameState.mustRoll && !canBuy && !gameState.canRollAgain && (
                    <button className="action-btn end-turn-btn" onClick={onEndTurn}>
                      ⏭️ End Turn
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
