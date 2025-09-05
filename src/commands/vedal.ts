import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, VoiceChannel } from 'discord.js';
import { audioManager } from '../services/audioManager.js';
import { prisma } from '../services/database.js';

export const data = new SlashCommandBuilder()
  .setName('vedal')
  .setDescription('Play a random Vedal sound')
  .addStringOption(option =>
    option.setName('mode')
      .setDescription('Specific type of Vedal sound')
      .setRequired(false)
      .addChoices(
        { name: 'Random', value: 'random' },
        { name: 'Reactions', value: 'reactions' },
        { name: 'Screams', value: 'screams' },
        { name: 'Cursed', value: 'cursed' },
        { name: 'Miscellaneous', value: 'misc' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember;
  const voiceChannel = member.voice.channel;

  if (!voiceChannel || voiceChannel.type !== 2) {
    await interaction.reply({ content: 'You need to be in a voice channel to play sounds!', ephemeral: true });
    return;
  }

  const mode = interaction.options.getString('mode');

  try {
    // Build query for Vedal sounds
    const whereClause: any = { person: 'vedal' };
    if (mode && mode !== 'random') {
      whereClause.category = mode;
    }

    const sounds = await prisma.sound.findMany({
      where: whereClause
    });

    if (sounds.length === 0) {
      const modeText = mode ? ` (${mode})` : '';
      await interaction.reply({ content: `❌ No Vedal sounds found${modeText}!`, ephemeral: true });
      return;
    }

    // Pick random Vedal sound
    const randomSound = sounds[Math.floor(Math.random() * sounds.length)];

    await audioManager.joinChannel(voiceChannel as VoiceChannel);
    const success = await audioManager.playSound(interaction.guild.id, randomSound.name, interaction.user.id);

    if (success) {
      await interaction.reply(`🐢 Playing Vedal sound: **${randomSound.name}** [${randomSound.category}]`);
    } else {
      await interaction.reply({ content: '❌ Failed to play the Vedal sound!', ephemeral: true });
    }
  } catch (error) {
    console.error('Error in vedal command:', error);
    await interaction.reply({ content: 'An error occurred while trying to play a Vedal sound.', ephemeral: true });
  }
}