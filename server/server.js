// server/server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const socketIo = require('socket.io');
const http = require('http');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/project'); // Fixed path
const taskRoutes = require('./routes/task');       // Fixed path
const commentRoutes = require('./routes/comment'); // Fixed path

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error(err));

// Socket.io for real-time communication
io.on('connection', (socket) => {
  console.log('New client connected');
  
  // Join project room
  socket.on('joinProject', (projectId) => {
    socket.join(projectId);
    console.log(`User joined project: ${projectId}`);
  });
  
  // Leave project room
  socket.on('leaveProject', (projectId) => {
    socket.leave(projectId);
    console.log(`User left project: ${projectId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Make io accessible to our router
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/comments', commentRoutes);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));