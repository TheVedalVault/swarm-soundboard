import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '../services/database.js';

export const data = new SlashCommandBuilder()
  .setName('volume')
  .setDescription('Set or check the volume for this server')
  .addNumberOption(option =>
    option.setName('level')
      .setDescription('Volume level (0.1 to 1.0)')
      .setMinValue(0.1)
      .setMaxValue(1.0)
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
    return;
  }

  const volumeLevel = interaction.options.getNumber('level');

  if (volumeLevel === null) {
    // Show current volume
    const serverConfig = await prisma.serverConfig.findUnique({
      where: { guildId: interaction.guild.id }
    });
    const currentVolume = serverConfig?.volume || 0.5;
    await interaction.reply(`🔊 Current volume: **${Math.round(currentVolume * 100)}%**`);
    return;
  }

  // Set new volume
  try {
    await prisma.serverConfig.upsert({
      where: { guildId: interaction.guild.id },
      update: { volume: volumeLevel },
      create: { 
        guildId: interaction.guild.id, 
        volume: volumeLevel 
      }
    });

    await interaction.reply(`🔊 Volume set to **${Math.round(volumeLevel * 100)}%**`);
  } catch (error) {
    console.error('Error setting volume:', error);
    await interaction.reply({ content: 'Failed to set volume.', ephemeral: true });
  }
}