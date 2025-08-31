const io = require('socket.io-client');

// Test WebSocket-based AI streaming
async function testWebSocketStreaming() {
  console.log('🧪 Testing WebSocket-based AI streaming...');
  
  // Create two client connections to simulate multiple users
  const client1 = io('http://localhost:9000', {
    auth: {
      token: 'your-jwt-token-here' // Replace with actual JWT token
    }
  });
  
  const client2 = io('http://localhost:9000', {
    auth: {
      token: 'your-jwt-token-here' // Replace with actual JWT token
    }
  });

  // Test event handlers for client 1
  client1.on('connect', () => {
    console.log('✅ Client 1 connected');
    
    // Join a conversation
    client1.emit('join-conversation', { conversationId: 'test-conversation-id' });
  });

  client1.on('ai-streaming-start', (message) => {
    console.log('Client 1 received AI streaming start:', message.id);
  });

  client1.on('ai-streaming-token', (data) => {
    console.log('Client 1 received AI token:', data.token);
  });

  client1.on('ai-streaming-complete', (message) => {
    console.log('Client 1 received AI streaming complete:', message.id);
  });

  // Test event handlers for client 2
  client2.on('connect', () => {
    console.log('✅ Client 2 connected');
    
    // Join the same conversation
    client2.emit('join-conversation', { conversationId: 'test-conversation-id' });
  });

  client2.on('ai-streaming-start', (message) => {
    console.log('Client 2 received AI streaming start:', message.id);
  });

  client2.on('ai-streaming-token', (data) => {
    console.log('Client 2 received AI token:', data.token);
  });

  client2.on('ai-streaming-complete', (message) => {
    console.log('Client 2 received AI streaming complete:', message.id);
  });

  // Wait for both clients to connect, then send a message
  setTimeout(() => {
    console.log(' Sending message with AI via WebSocket...');
    client1.emit('send-message-with-ai', {
      conversationId: 'test-conversation-id',
      content: 'Hello, can you help me with a coding question?',
      messageId: 'test-message-' + Date.now()
    });
  }, 2000);

  // Cleanup after test
  setTimeout(() => {
    console.log('🧹 Cleaning up test connections...');
    client1.disconnect();
    client2.disconnect();
    process.exit(0);
  }, 10000);
}

// Run the test
testWebSocketStreaming().catch(console.error);
