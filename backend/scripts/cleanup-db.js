const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupDatabase() {
  try {
    console.log('Starting database cleanup...');

    // Get all conversation IDs that exist
    const existingConversations = await prisma.conversation.findMany({
      select: { id: true },
    });
    const existingConversationIds = existingConversations.map(c => c.id);

    // Clean up orphaned participant records
    const orphanedParticipants = await prisma.conversationParticipant.findMany({
      where: {
        conversationId: {
          notIn: existingConversationIds,
        },
      },
    });

    if (orphanedParticipants.length > 0) {
      console.log(`Found ${orphanedParticipants.length} orphaned participant records`);
      await prisma.conversationParticipant.deleteMany({
        where: {
          conversationId: {
            notIn: existingConversationIds,
          },
        },
      });
      console.log('Cleaned up orphaned participant records');
    } else {
      console.log('No orphaned participant records found');
    }

    // Clean up orphaned invitations
    const orphanedInvitations = await prisma.invitation.findMany({
      where: {
        conversationId: {
          notIn: existingConversationIds,
        },
      },
    });

    if (orphanedInvitations.length > 0) {
      console.log(`Found ${orphanedInvitations.length} orphaned invitations`);
      await prisma.invitation.updateMany({
        where: {
          conversationId: {
            notIn: existingConversationIds,
          },
        },
        data: {
          status: 'EXPIRED',
        },
      });
      console.log('Cleaned up orphaned invitations');
    } else {
      console.log('No orphaned invitations found');
    }

    // Clean up expired invitations (older than 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const expiredInvitations = await prisma.invitation.updateMany({
      where: {
        status: { in: ['ACCEPTED', 'DECLINED'] },
        updatedAt: {
          lt: thirtyDaysAgo,
        },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    console.log(`Updated ${expiredInvitations.count} old invitations to EXPIRED status`);

    // Clean up any duplicate participant records
    const duplicateParticipants = await prisma.$queryRaw`
      SELECT userId, conversationId, COUNT(*) as count
      FROM conversation_participants
      GROUP BY userId, conversationId
      HAVING COUNT(*) > 1
    `;

    if (duplicateParticipants.length > 0) {
      console.log(`Found ${duplicateParticipants.length} duplicate participant records`);
      
      for (const duplicate of duplicateParticipants) {
        // Keep the first record, delete the rest
        await prisma.conversationParticipant.deleteMany({
          where: {
            userId: duplicate.userId,
            conversationId: duplicate.conversationId,
          },
          skip: 1, // Skip the first record
        });
      }
      console.log('Cleaned up duplicate participant records');
    } else {
      console.log('No duplicate participant records found');
    }

    console.log('Database cleanup completed successfully!');
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDatabase();
