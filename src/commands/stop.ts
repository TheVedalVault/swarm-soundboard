import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { audioManager } from '../services/audioManager.js';

export const data = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('Stop playing sounds and clear the queue');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember;
  const voiceChannel = member.voice.channel;

  if (!voiceChannel) {
    await interaction.reply({ content: 'You need to be in a voice channel to use this command!', ephemeral: true });
    return;
  }

  audioManager.stopPlaying(interaction.guild.id);
  await interaction.reply('⏹️ Stopped playing and cleared the queue.');
}