// ============================================
// MONOPOLY GAME - CLIENT TYPES
// ============================================

export type TileType =
  | 'PROPERTY'
  | 'RAILROAD'
  | 'UTILITY'
  | 'GO'
  | 'JAIL'
  | 'FREE_PARKING'
  | 'GO_TO_JAIL'
  | 'TAX'
  | 'CHANCE'
  | 'COMMUNITY_CHEST';

export interface Tile {
  id: string;
  name: string;
  type: TileType;
  price?: number;
  rent?: number[];
  group?: string;
  owner?: string;
  icon?: string;
  watermark?: string;
  houses: number;
  houseCost?: number;
  isMortgaged: boolean;
  nativeName?: string; // Native script name (e.g. Hindi, Telugu)
}

export interface Player {
  id: string;
  name: string;
  money: number;
  position: number;
  color: string;
  properties: string[];
  isJailed: boolean;
  jailTurns: number;
  isBankrupt: boolean;
  getOutOfJailCards: number;
  vacationFund: number;
  vacationTurnsLeft?: number;
  isHost: boolean;
  isReady: boolean;
  avatar: string; // Emoji character
  isDisconnected: boolean;
  disconnectedAt?: number;
}

export interface Card {
  id: string;
  type: 'CHANCE' | 'COMMUNITY_CHEST';
  description: string;
  action: string;
  value?: number;
  destination?: number;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
  color: string;
}

export interface GameConfig {
  maxPlayers: number;
  isPrivate: boolean;
  startingCash: number;
  doubleRentOnMonopoly: boolean;
  vacationCash: boolean;
  auctionEnabled: boolean;
  collectRentInJail: boolean;
  mortgageEnabled: boolean;
  evenBuild: boolean;
  randomizeOrder: boolean;
  mapId: string;
  autoAuction: boolean;
  reconnectTimeoutSeconds: number;
}

export const DEFAULT_CONFIG: GameConfig = {
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
};

export interface RoomInfo {
  id: string;
  name: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  isPrivate: boolean;
  gameStarted: boolean;
  mapId: string;
}

// ============================================
// TRADING & AUCTION
// ============================================

export interface TradeOffer {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  offerProperties: string[];
  offerMoney: number;
  requestProperties: string[];
  requestMoney: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
}

export interface Auction {
  tileId: string;
  tileName: string;
  currentBid: number;
  highestBidderId?: string;
  highestBidderName?: string;
  participants: string[];
  endTime: number;
  isActive: boolean;
}

export interface GameState {
  id: string;
  roomName: string;
  config: GameConfig;
  players: Player[];
  currentPlayerIndex: number;
  board: Tile[];
  gameStarted: boolean;
  gameOver: boolean;
  winnerId?: string;
  dice: number[];
  doublesCount: number;
  canRollAgain: boolean;
  mustRoll: boolean;
  lastAction: string;
  actionLog: string[];
  currentCard?: Card;
  freeParkingPot: number;
  trades: TradeOffer[];
  auction?: Auction;
  awaitingBuyDecision: boolean;
}
