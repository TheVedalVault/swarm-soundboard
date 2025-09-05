import { MessageReaction, PartialMessageReaction, User, PartialUser, VoiceChannel } from 'discord.js';
import { prisma } from '../services/database.js';
import { audioManager } from '../services/audioManager.js';

export async function execute(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
  // Ignore bot reactions
  if (user.bot) return;

  // Handle partial data (fetch full data if needed)
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('Error fetching reaction:', error);
      return;
    }
  }

  if (user.partial) {
    try {
      await user.fetch();
    } catch (error) {
      console.error('Error fetching user:', error);
      return;
    }
  }

  const guild = reaction.message.guild;
  if (!guild) return;

  try {
    // Check if react-to-play is enabled for this server
    const serverConfig = await prisma.serverConfig.findUnique({
      where: { guildId: guild.id }
    });

    const isEnabled = serverConfig?.reactToPlayEnabled ?? true;
    if (!isEnabled) return;

    // Get the emoji string (handle both unicode and custom emojis)
    const emojiIdentifier = reaction.emoji.id ? 
      `<:${reaction.emoji.name}:${reaction.emoji.id}>` : 
      reaction.emoji.name;

    if (!emojiIdentifier) return;

    // Find the mapped sound for this emoji
    const reactionSound = await prisma.reactionSound.findUnique({
      where: {
        guildId_emoji: {
          guildId: guild.id,
          emoji: emojiIdentifier
        }
      },
      include: { sound: true }
    });

    if (!reactionSound) return;

    // Get the user's voice channel
    const member = await guild.members.fetch(user.id);
    const voiceChannel = member.voice.channel;

    if (!voiceChannel || voiceChannel.type !== 2) {
      console.log(`User ${user.username} reacted with ${emojiIdentifier} but is not in a voice channel`);
      return;
    }

    // Join voice channel and add reaction sound to priority queue
    await audioManager.joinChannel(voiceChannel as VoiceChannel);
    const success = await audioManager.playSound(guild.id, reactionSound.sound.name, user.id, true);

    if (success) {
      console.log(`🎭 Reaction-triggered sound: ${reactionSound.sound.name} by ${user.username} (${emojiIdentifier})`);
    }
  } catch (error) {
    console.error('Error in messageReactionAdd event:', error);
  }
}