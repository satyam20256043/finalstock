const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const ADMIN_PASSWORD = "boss";

let state = {
    marketOpen: true,
    timeRemaining: 600,
    news: "WAITING FOR ADMIN TO START THE ROUND...",
    stocks: {
        ALPH: { name: 'Alpha Tech', price: 1200, history: Array(20).fill(1200), color: '#00d4ff', active: true },
        BETA: { name: 'Beta Energy', price: 850, history: Array(20).fill(850), color: '#ffcc00', active: true },
        GAMM: { name: 'Gamma Realty', price: 420, history: Array(20).fill(420), color: '#ff3366', active: true },
        DELT: { name: 'Delta Pharma', price: 2100, history: Array(20).fill(2100), color: '#00ff88', active: true }
    },
    players: {} 
};

setInterval(() => {
    if (!state.marketOpen || state.timeRemaining <= 0) return;
    state.timeRemaining--;

    Object.keys(state.stocks).forEach(symbol => {
        const stock = state.stocks[symbol];
        const change = 1 + (Math.random() * 0.04 - 0.02);
        stock.price *= change;
        stock.history.push(stock.price);
        if (stock.history.length > 25) stock.history.shift();
    });
    io.emit('sync', state);
}, 1000);

io.on('connection', (socket) => {
    socket.emit('sync', state);

    socket.on('trade', (d) => {
        if (!state.marketOpen || !state.players[d.playerName]) return;
        let p = state.players[d.playerName];
        let price = state.stocks[d.symbol].price;
        if (d.type === 'BUY' && p.cash >= d.qty * price) {
            p.cash -= d.qty * price;
            p.holdings[d.symbol] += d.qty;
        } else if (d.type === 'SELL' && p.holdings[d.symbol] >= d.qty) {
            p.cash += d.qty * price;
            p.holdings[d.symbol] -= d.qty;
        }
        io.emit('sync', state);
    });

    socket.on('adminAction', (d) => {
        if (d.password !== ADMIN_PASSWORD) return;
        if (d.type === 'REG_PLAYER') {
            state.players[d.name] = { name: d.name, cash: 100000, holdings: { ALPH:0, BETA:0, GAMM:0, DELT:0 } };
            state.news = `NEW TEAM: ${d.name.toUpperCase()} HAS ENTERED THE FLOOR!`;
        }
        if (d.type === 'RESET') {
            state.timeRemaining = 600;
            state.players = {};
            state.news = "SYSTEM REBOOTED. REGISTER ALL TEAMS AGAIN.";
        }
        if (d.type === 'STOCK_EVENT') {
            state.stocks[d.symbol].price *= (1 + d.factor);
            state.news = `⚠ ${state.stocks[d.symbol].name.toUpperCase()} ${d.factor > 0 ? 'BOOMING' : 'CRASHING'}!`;
        }
        if (d.type === 'GLOBAL') {
            const f = d.event === 'CRASH' ? 0.7 : 1.4;
            Object.keys(state.stocks).forEach(s => state.stocks[s].price *= f);
            state.news = `🚨 ${d.event} TRIGGERED ACROSS ALL SECTORS!`;
        }
        if (d.type === 'HALT') state.marketOpen = !state.marketOpen;
        io.emit('sync', state);
    });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
server.listen(1100, '0.0.0.0', () => console.log("SERVER RUNNING ON PORT 1100"));