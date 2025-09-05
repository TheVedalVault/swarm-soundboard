import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, VoiceChannel, AutocompleteInteraction } from 'discord.js';
import { audioManager } from '../services/audioManager.js';
import { prisma } from '../services/database.js';

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Play a sound in your voice channel')
  .addStringOption(option =>
    option.setName('sound')
      .setDescription('The name of the sound to play')
      .setRequired(true)
      .setAutocomplete(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember;
  const voiceChannel = member.voice.channel;

  if (!voiceChannel || voiceChannel.type !== 2) { // 2 = GUILD_VOICE
    await interaction.reply({ content: 'You need to be in a voice channel to play sounds!', ephemeral: true });
    return;
  }

  const soundName = interaction.options.getString('sound', true);

  try {
    // Join voice channel if not already connected
    await audioManager.joinChannel(voiceChannel as VoiceChannel);

    // Play the sound (use queue system for commands)
    const success = await audioManager.playSound(interaction.guild.id, soundName, interaction.user.id, false);

    if (success) {
      const queueLength = audioManager.getQueue(interaction.guild.id).length;
      if (queueLength > 1) {
        await interaction.reply(`🎵 **${soundName}** added to queue (position ${queueLength})`);
      } else {
        await interaction.reply(`🎵 Playing sound: **${soundName}**`);
      }
    } else {
      // Check if it's a queue limit issue
      const serverConfig = await prisma.serverConfig.findUnique({
        where: { guildId: interaction.guild.id }
      });
      const maxQueueSize = serverConfig?.maxQueueSize || 10;
      const currentQueueSize = audioManager.getQueue(interaction.guild.id).length;
      
      if (currentQueueSize >= maxQueueSize) {
        await interaction.reply({ content: `❌ Queue is full! (${currentQueueSize}/${maxQueueSize} sounds). Wait for some to finish or ask an admin to increase the queue limit with \`/server queue-limit\`.`, ephemeral: true });
      } else {
        await interaction.reply({ content: `❌ Sound "${soundName}" not found!`, ephemeral: true });
      }
    }
  } catch (error) {
    console.error('Error in play command:', error);
    await interaction.reply({ content: 'An error occurred while trying to play the sound.', ephemeral: true });
  }
}

export async function autocomplete(interaction: AutocompleteInteraction) {
  const focusedValue = interaction.options.getFocused().toLowerCase();
  
  try {
    // Search for sounds that match the input
    const sounds = await prisma.sound.findMany({
      where: {
        name: {
          contains: focusedValue
        }
      },
      orderBy: [
        { playCount: 'desc' }, // Prioritize popular sounds
        { name: 'asc' }        // Then alphabetical
      ],
      take: 25 // Discord limits autocomplete to 25 options
    });

    // Format results for Discord
    const choices = sounds.map(sound => ({
      name: `${sound.name} (${sound.person}) [${sound.category}]`,
      value: sound.name
    }));

    await interaction.respond(choices);
  } catch (error) {
    console.error('Error in autocomplete:', error);
    await interaction.respond([]);
  }
}