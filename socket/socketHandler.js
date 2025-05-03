import User from '../models/User.js';
import Lawyer from '../models/LawyerProfile.js';

export default function initSocketHandler(io) {
  io.on('connection', (socket) => {
    console.log('New socket connection:', socket.id);
    
    // Handle authentication
    socket.on('authenticate', async (data) => {
      try {
        console.log('Socket authentication attempt:', data);
        
        if (!data || !data.token) {
          console.error('Missing token in authentication data');
          socket.emit('authError', { message: 'Missing token' });
          return;
        }
        
        const { token, userId, role } = data;
        
        let authenticatedUser = null;
        let isLawyerDirect = false;
        
        // First check if this is a direct lawyer login
        if (role === 'lawyer') {
          // Try to find lawyer by ID and token directly
          const lawyer = await Lawyer.findOne({ 
            _id: userId,
            'sessions.token': token 
          });
          
          if (lawyer) {
            isLawyerDirect = true;
            authenticatedUser = {
              _id: lawyer._id,
              name: lawyer.name,
              role: 'lawyer'
            };
            console.log(`Direct lawyer authentication successful for: ${lawyer._id}`);
          }
        }
        
        // If not a direct lawyer login or lawyer not found, check User model
        if (!authenticatedUser) {
          const user = await User.findOne({ 
            'sessions.token': token 
          });
          
          if (user) {
            authenticatedUser = user;
            console.log(`User authentication successful for: ${user._id}, role: ${user.role}`);
            
            // If user is a lawyer, try to get their lawyerId
            if (user.role === 'lawyer') {
              const lawyerProfile = await Lawyer.findOne({ userId: user._id });
              if (lawyerProfile) {
                authenticatedUser.lawyerId = lawyerProfile._id;
              }
            }
          }
        }
        
        if (!authenticatedUser) {
          console.error('Invalid session token');
          socket.emit('authError', { message: 'Invalid session' });
          return;
        }
        
        // Store user info in socket
        socket.userId = authenticatedUser._id.toString();
        socket.userRole = authenticatedUser.role;
        socket.isLawyerDirect = isLawyerDirect;
        
        // Join user-specific room
        socket.join(`user-${socket.userId}`);
        
        // If lawyer, join lawyer-specific room
        if (socket.userRole === 'lawyer') {
          // For direct lawyer login, use their own ID as the lawyerId
          const lawyerId = isLawyerDirect ? socket.userId : authenticatedUser.lawyerId?.toString();
          
          if (lawyerId) {
            socket.join(`lawyer-${lawyerId}`);
            socket.lawyerId = lawyerId;
            console.log(`Joined lawyer room: lawyer-${lawyerId}`);
          } else {
            console.warn('Lawyer user without lawyer profile ID');
          }
        }
        
        console.log(`User ${socket.userId} (${socket.userRole}) authenticated successfully`);
        socket.emit('authenticated');
      } catch (error) {
        console.error('Socket authentication error:', error);
        socket.emit('authError', { message: 'Authentication failed' });
      }
    });
    
    // Handle chat room joining
    socket.on('joinRoom', (data) => {
      const { chatId } = data;
      
      if (!socket.userId) {
        console.error('Unauthenticated socket tried to join room');
        socket.emit('error', { message: 'Authentication required' });
        return;
      }
      
      console.log(`User ${socket.userId} joining chat room ${chatId}`);
      socket.join(`chat-${chatId}`);
    });
    
    // Handle sending messages
    socket.on('sendMessage', (data) => {
      const { chatId, text, sender } = data;
      
      if (!socket.userId) {
        console.error('Unauthenticated socket tried to send message');
        socket.emit('error', { message: 'Authentication required' });
        return;
      }
      
      console.log(`Message from ${sender} in chat ${chatId}: ${text?.substring(0, 30)}...`);
      
      // Broadcast to all in the chat room
      io.to(`chat-${chatId}`).emit('receiveMessage', {
        chatId,
        sender,
        text,
        timestamp: new Date(),
        fromUserId: socket.userId
      });
    });
    
    // Handle user typing indicator
    socket.on('typing', (data) => {
      const { chatId } = data;
      
      if (!socket.userId || !chatId) return;
      
      // Broadcast to others in the room
      socket.to(`chat-${chatId}`).emit('userTyping', {
        chatId,
        userId: socket.userId,
        role: socket.userRole
      });
    });
    
    socket.on('stopTyping', (data) => {
      const { chatId } = data;
      
      if (!socket.userId || !chatId) return;
      
      socket.to(`chat-${chatId}`).emit('userStoppedTyping', {
        chatId,
        userId: socket.userId,
        role: socket.userRole
      });
    });
    
    socket.on('markAsRead', (data) => {
      const { chatId } = data;
      
      if (!socket.userId || !chatId) return;
      
      socket.to(`chat-${chatId}`).emit('messagesRead', {
        chatId,
        userId: socket.userId,
        role: socket.userRole
      });
    });
    
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}
