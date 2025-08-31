-- Collaborative AI Chat Application Database Schema
-- MySQL Database Schema for the collaborative chat application
-- This file contains the complete database structure

-- Create the database
CREATE DATABASE IF NOT EXISTS collaborative_chat;
USE collaborative_chat;

-- Users table - stores user account information
CREATE TABLE users (
    id VARCHAR(191) NOT NULL PRIMARY KEY,
    email VARCHAR(191) NOT NULL UNIQUE,
    password VARCHAR(191) NOT NULL,
    name VARCHAR(191),
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_users_email (email)
);

-- Conversations table - stores chat conversations
CREATE TABLE conversations (
    id VARCHAR(191) NOT NULL PRIMARY KEY,
    title VARCHAR(191),
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_conversations_updated (updatedAt)
);

-- Conversation participants table - many-to-many relationship between users and conversations
CREATE TABLE conversation_participants (
    id VARCHAR(191) NOT NULL PRIMARY KEY,
    userId VARCHAR(191) NOT NULL,
    conversationId VARCHAR(191) NOT NULL,
    joinedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY unique_user_conversation (userId, conversationId),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE,
    INDEX idx_participants_user (userId),
    INDEX idx_participants_conversation (conversationId)
);

-- Messages table - stores all chat messages (user, AI, system)
CREATE TABLE messages (
    id VARCHAR(191) NOT NULL PRIMARY KEY,
    content TEXT NOT NULL,
    type ENUM('USER', 'AI', 'SYSTEM') NOT NULL DEFAULT 'USER',
    userId VARCHAR(191),
    conversationId VARCHAR(191) NOT NULL,
    metadata JSON,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE,
    INDEX idx_messages_conversation (conversationId),
    INDEX idx_messages_created (createdAt),
    INDEX idx_messages_user (userId)
);

-- Conversation memory table - stores LangChain memory data per conversation
CREATE TABLE conversation_memory (
    id VARCHAR(191) NOT NULL PRIMARY KEY,
    conversationId VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    value JSON NOT NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY unique_conversation_key (conversationId, `key`),
    FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE,
    INDEX idx_memory_conversation (conversationId)
);

-- Invitations table - stores conversation invitations
CREATE TABLE invitations (
    id VARCHAR(191) NOT NULL PRIMARY KEY,
    email VARCHAR(191) NOT NULL,
    senderId VARCHAR(191) NOT NULL,
    receiverId VARCHAR(191),
    conversationId VARCHAR(191) NOT NULL,
    status ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiverId) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE,
    INDEX idx_invitations_receiver (receiverId),
    INDEX idx_invitations_sender (senderId),
    INDEX idx_invitations_conversation (conversationId),
    INDEX idx_invitations_status (status)
);

-- Insert sample data (optional)
-- You can uncomment these lines to insert sample data for testing

/*
-- Sample users
INSERT INTO users (id, email, password, name) VALUES 
('user1', 'alice@example.com', '$2b$10$example_hashed_password_1', 'Alice Johnson'),
('user2', 'bob@example.com', '$2b$10$example_hashed_password_2', 'Bob Smith');

-- Sample conversation
INSERT INTO conversations (id, title) VALUES 
('conv1', 'AI Discussion Room');

-- Sample participants
INSERT INTO conversation_participants (id, userId, conversationId) VALUES 
('part1', 'user1', 'conv1'),
('part2', 'user2', 'conv1');

-- Sample messages
INSERT INTO messages (id, content, type, userId, conversationId) VALUES 
('msg1', 'Hello! How can AI help us today?', 'USER', 'user1', 'conv1'),
('msg2', 'Hello! I''m here to assist you with any questions or tasks you might have. As an AI assistant, I can help with a wide variety of topics including answering questions, helping with analysis, creative tasks, and much more. What would you like to explore today?', 'AI', NULL, 'conv1'),
('msg3', 'That''s great! Can you explain machine learning?', 'USER', 'user2', 'conv1');
*/

-- Performance optimization indexes
CREATE INDEX idx_messages_conversation_created ON messages(conversationId, createdAt);
CREATE INDEX idx_participants_user_joined ON conversation_participants(userId, joinedAt);
CREATE INDEX idx_invitations_receiver_status ON invitations(receiverId, status);

-- Views for common queries (optional)

-- View for conversation with participant count
CREATE VIEW conversation_summary AS
SELECT 
    c.id,
    c.title,
    c.createdAt,
    c.updatedAt,
    COUNT(cp.userId) as participant_count,
    (SELECT COUNT(*) FROM messages m WHERE m.conversationId = c.id) as message_count
FROM conversations c
LEFT JOIN conversation_participants cp ON c.id = cp.conversationId
GROUP BY c.id, c.title, c.createdAt, c.updatedAt;

-- View for user conversation list with latest message
CREATE VIEW user_conversations AS
SELECT 
    c.id as conversation_id,
    c.title,
    c.updatedAt,
    cp.userId,
    cp.joinedAt,
    m.content as latest_message,
    m.createdAt as latest_message_time,
    m.type as latest_message_type,
    u.name as latest_message_user
FROM conversations c
JOIN conversation_participants cp ON c.id = cp.conversationId
LEFT JOIN messages m ON c.id = m.conversationId 
    AND m.createdAt = (
        SELECT MAX(createdAt) 
        FROM messages m2 
        WHERE m2.conversationId = c.id
    )
LEFT JOIN users u ON m.userId = u.id;

-- Stored procedures for common operations (optional)

DELIMITER //

-- Procedure to add user to conversation
CREATE PROCEDURE AddUserToConversation(
    IN p_user_id VARCHAR(191),
    IN p_conversation_id VARCHAR(191)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Check if user is already a participant
    IF NOT EXISTS (
        SELECT 1 FROM conversation_participants 
        WHERE userId = p_user_id AND conversationId = p_conversation_id
    ) THEN
        INSERT INTO conversation_participants (id, userId, conversationId)
        VALUES (UUID(), p_user_id, p_conversation_id);
    END IF;
    
    COMMIT;
END //

-- Procedure to clean up expired invitations
CREATE PROCEDURE CleanupExpiredInvitations()
BEGIN
    UPDATE invitations 
    SET status = 'EXPIRED' 
    WHERE status = 'PENDING' 
    AND createdAt < DATE_SUB(NOW(), INTERVAL 7 DAY);
END //

DELIMITER ;

-- Triggers for maintaining data consistency

-- Trigger to update conversation updatedAt when new message is added
DELIMITER //
CREATE TRIGGER update_conversation_timestamp 
    AFTER INSERT ON messages
    FOR EACH ROW
BEGIN
    UPDATE conversations 
    SET updatedAt = NOW() 
    WHERE id = NEW.conversationId;
END //
DELIMITER ;

-- Trigger to prevent self-invitations
DELIMITER //
CREATE TRIGGER prevent_self_invitation
    BEFORE INSERT ON invitations
    FOR EACH ROW
BEGIN
    IF NEW.senderId = NEW.receiverId THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Cannot send invitation to yourself';
    END IF;
END //
DELIMITER ;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON collaborative_chat.* TO 'chat_user'@'localhost' IDENTIFIED BY 'your_password';
-- FLUSH PRIVILEGES;

-- Show table structure
SHOW TABLES;
DESCRIBE users;
DESCRIBE conversations;
DESCRIBE conversation_participants;
DESCRIBE messages;
DESCRIBE conversation_memory;
DESCRIBE invitations; 