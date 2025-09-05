import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { audioManager } from '../services/audioManager.js';

export const data = new SlashCommandBuilder()
  .setName('leave')
  .setDescription('Leave the voice channel');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
    return;
  }

  audioManager.leaveChannel(interaction.guild.id);
  await interaction.reply('👋 Left the voice channel.');
}