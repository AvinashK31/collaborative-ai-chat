const io = require('socket.io-client');

// Test configuration
const SERVER_URL = 'http://localhost:3001';

// Test tokens - replace these with actual valid tokens from your database
const USER1_TOKEN = 'your_user1_token_here';  // User who will receive notifications
const USER2_TOKEN = 'your_user2_token_here';  // User who will send messages

console.log('🧪 Real-Time Notification Badge Test');
console.log('==================================');
console.log('This test simulates cross-conversation messaging to verify badge updates');
console.log('');

// Create two socket connections to simulate different users
const user1Socket = io(SERVER_URL, {
  auth: { token: USER1_TOKEN },
  autoConnect: false
});

const user2Socket = io(SERVER_URL, {
  auth: { token: USER2_TOKEN },
  autoConnect: false
});

// User 1 - Badge receiver
user1Socket.on('connect', () => {
  console.log('✅ User 1 connected (Badge Receiver)');
  console.log('   Socket ID:', user1Socket.id);
  
  // Listen for cross-conversation messages (this should trigger badge updates)
  user1Socket.on('new-message', (message) => {
    console.log('🔔 User 1 received message:', {
      id: message.id,
      content: message.content.substring(0, 50) + '...',
      type: message.type,
      conversationId: message.conversationId,
      fromUser: message.user?.email || 'Unknown'
    });
    console.log('   🚨 This should trigger a notification badge update!');
  });
});

// User 2 - Message sender
user2Socket.on('connect', () => {
  console.log('✅ User 2 connected (Message Sender)');
  console.log('   Socket ID:', user2Socket.id);
});

// Error handling
[user1Socket, user2Socket].forEach((socket, index) => {
  socket.on('connect_error', (error) => {
    console.error(`❌ User ${index + 1} connection error:`, error.message);
  });
  
  socket.on('disconnect', (reason) => {
    console.log(`⚠️ User ${index + 1} disconnected:`, reason);
  });
});

// Start test sequence
console.log('🚀 Starting connection test...');
console.log('');

// Connect both users
user1Socket.connect();
user2Socket.connect();

// Wait a bit then test messaging
setTimeout(() => {
  console.log('');
  console.log('📝 Test Instructions:');
  console.log('1. Make sure both users are connected above');
  console.log('2. Open your browser with User 1 logged in');
  console.log('3. Navigate to a conversation');  
  console.log('4. Open another tab or switch to a different conversation');
  console.log('5. Use the API or another browser to send a message from User 2');
  console.log('6. Check if User 1 sees the notification badge update in real-time');
  console.log('');
  console.log('Expected behavior:');
  console.log('- Badge should update immediately without refresh');
  console.log('- Should work when tab is hidden or in background');
  console.log('- Should work when in a different conversation');
  console.log('');
}, 2000);

// Keep the test running
console.log('Press Ctrl+C to stop the test');

process.on('SIGINT', () => {
  console.log('');
  console.log('🛑 Stopping test...');
  user1Socket.disconnect();
  user2Socket.disconnect();
  process.exit(0);
}); 