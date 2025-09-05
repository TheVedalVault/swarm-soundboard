import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, VoiceChannel } from 'discord.js';
import { audioManager } from '../services/audioManager.js';
import { prisma } from '../services/database.js';

export const data = new SlashCommandBuilder()
  .setName('random')
  .setDescription('Play a random sound')
  .addStringOption(option =>
    option.setName('category')
      .setDescription('Filter by sound category')
      .setRequired(false)
      .addChoices(
        { name: 'Cursed Sounds', value: 'cursed' },
        { name: 'Reactions', value: 'reactions' },
        { name: 'Screams', value: 'screams' },
        { name: 'Miscellaneous', value: 'misc' }
      )
  )
  .addStringOption(option =>
    option.setName('person')
      .setDescription('Filter by person')
      .setRequired(false)
      .addChoices(
        { name: 'Vedal', value: 'vedal' },
        { name: 'Neuro', value: 'neuro' },
        { name: 'Evil', value: 'evil' },
        { name: 'Camila', value: 'camila' },
        { name: 'Cerber', value: 'cerber' },
        { name: 'Mini', value: 'mini' },
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

  const category = interaction.options.getString('category');
  const person = interaction.options.getString('person');

  try {
    // Build query filters
    const whereClause: any = {};
    if (category) whereClause.category = category;
    if (person) whereClause.person = person;

    // Get matching sounds
    const sounds = await prisma.sound.findMany({
      where: whereClause
    });

    if (sounds.length === 0) {
      const filterText = [category, person].filter(Boolean).join(' + ');
      const message = filterText 
        ? `❌ No sounds found matching: **${filterText}**`
        : '❌ No sounds available!';
      await interaction.reply({ content: message, ephemeral: true });
      return;
    }

    // Pick a random sound
    const randomSound = sounds[Math.floor(Math.random() * sounds.length)];

    // Join voice channel and play
    await audioManager.joinChannel(voiceChannel as VoiceChannel);
    const success = await audioManager.playSound(interaction.guild.id, randomSound.name, interaction.user.id);

    if (success) {
      const filterText = [category, person].filter(Boolean).join(' + ');
      const fromText = filterText ? ` from **${filterText}**` : '';
      await interaction.reply(`🎲 Playing random sound${fromText}: **${randomSound.name}** (${randomSound.person})`);
    } else {
      await interaction.reply({ content: '❌ Failed to play the selected sound!', ephemeral: true });
    }
  } catch (error) {
    console.error('Error in random command:', error);
    await interaction.reply({ content: 'An error occurred while trying to play a random sound.', ephemeral: true });
  }
}