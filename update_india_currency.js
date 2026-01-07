
const fs = require('fs');
const path = require('path');

const mapPath = path.join(__dirname, 'server/src/maps/india.json');
const rawData = fs.readFileSync(mapPath, 'utf8');
const tiles = JSON.parse(rawData);

const updatedTiles = tiles.map(tile => {
    if (tile.price) tile.price *= 100;
    if (tile.rent) tile.rent = tile.rent.map(r => r * 100);
    if (tile.houseCost) tile.houseCost *= 100;
    // Tax tiles might have specific logic in Game.ts, but if they have a price field (like 200), scale it.
    return tile;
});

fs.writeFileSync(mapPath, JSON.stringify(updatedTiles, null, 4));
console.log('Successfully scaled india.json values by 100x');
