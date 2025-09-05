import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { prisma } from '../services/database.js';

export const data = new SlashCommandBuilder()
  .setName('reactions')
  .setDescription('Manage react-to-play emoji mappings')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Map an emoji to a sound')
      .addStringOption(option =>
        option.setName('emoji')
          .setDescription('The emoji to use')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('sound')
          .setDescription('The sound name')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Remove an emoji mapping')
      .addStringOption(option =>
        option.setName('emoji')
          .setDescription('The emoji to remove')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all emoji mappings')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('toggle')
      .setDescription('Enable or disable react-to-play for this server')
      .addBooleanOption(option =>
        option.setName('enabled')
          .setDescription('Enable react-to-play')
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case 'add':
        await handleAdd(interaction);
        break;
      case 'remove':
        await handleRemove(interaction);
        break;
      case 'list':
        await handleList(interaction);
        break;
      case 'toggle':
        await handleToggle(interaction);
        break;
      default:
        await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
    }
  } catch (error) {
    console.error('Error in reactions command:', error);
    await interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
  }
}

async function handleAdd(interaction: ChatInputCommandInteraction) {
  const emoji = interaction.options.getString('emoji', true);
  const soundName = interaction.options.getString('sound', true);

  // Find the sound
  const sound = await prisma.sound.findFirst({
    where: { name: soundName }
  });

  if (!sound) {
    await interaction.reply({ content: `❌ Sound "${soundName}" not found!`, ephemeral: true });
    return;
  }

  try {
    // Create or update the reaction mapping
    await prisma.reactionSound.upsert({
      where: {
        guildId_emoji: {
          guildId: interaction.guild!.id,
          emoji: emoji
        }
      },
      update: {
        soundId: sound.id
      },
      create: {
        guildId: interaction.guild!.id,
        emoji: emoji,
        soundId: sound.id
      }
    });

    await interaction.reply(`✅ Mapped ${emoji} to **${sound.name}**!`);
  } catch (error) {
    console.error('Error adding reaction mapping:', error);
    await interaction.reply({ content: 'Failed to add emoji mapping.', ephemeral: true });
  }
}

async function handleRemove(interaction: ChatInputCommandInteraction) {
  const emoji = interaction.options.getString('emoji', true);

  try {
    const deleted = await prisma.reactionSound.deleteMany({
      where: {
        guildId: interaction.guild!.id,
        emoji: emoji
      }
    });

    if (deleted.count > 0) {
      await interaction.reply(`✅ Removed mapping for ${emoji}`);
    } else {
      await interaction.reply({ content: `❌ No mapping found for ${emoji}`, ephemeral: true });
    }
  } catch (error) {
    console.error('Error removing reaction mapping:', error);
    await interaction.reply({ content: 'Failed to remove emoji mapping.', ephemeral: true });
  }
}

async function handleList(interaction: ChatInputCommandInteraction) {
  const reactionSounds = await prisma.reactionSound.findMany({
    where: { guildId: interaction.guild!.id },
    include: { sound: true },
    orderBy: { emoji: 'asc' }
  });

  if (reactionSounds.length === 0) {
    await interaction.reply('📄 No emoji mappings configured for this server!');
    return;
  }

  const serverConfig = await prisma.serverConfig.findUnique({
    where: { guildId: interaction.guild!.id }
  });
  const isEnabled = serverConfig?.reactToPlayEnabled ?? true;

  const embed = new EmbedBuilder()
    .setTitle('🎭 React-to-Play Mappings')
    .setColor(isEnabled ? 0x00AE86 : 0xFF0000)
    .setDescription(
      reactionSounds.map(rs => 
        `${rs.emoji} → **${rs.sound.name}** (${rs.sound.person})`
      ).join('\n')
    )
    .setFooter({ 
      text: `React-to-play is ${isEnabled ? 'ENABLED' : 'DISABLED'} • ${reactionSounds.length} mapping(s)` 
    });

  await interaction.reply({ embeds: [embed] });
}

async function handleToggle(interaction: ChatInputCommandInteraction) {
  const enabled = interaction.options.getBoolean('enabled', true);

  try {
    await prisma.serverConfig.upsert({
      where: { guildId: interaction.guild!.id },
      update: { reactToPlayEnabled: enabled },
      create: { 
        guildId: interaction.guild!.id,
        reactToPlayEnabled: enabled
      }
    });

    const status = enabled ? 'enabled' : 'disabled';
    await interaction.reply(`✅ React-to-play ${status} for this server!`);
  } catch (error) {
    console.error('Error toggling react-to-play:', error);
    await interaction.reply({ content: 'Failed to update react-to-play setting.', ephemeral: true });
  }
}

export async function autocomplete(interaction: any) {
  const focusedValue = interaction.options.getFocused().toLowerCase();
  
  try {
    const sounds = await prisma.sound.findMany({
      where: {
        name: {
          contains: focusedValue
        }
      },
      orderBy: [
        { playCount: 'desc' },
        { name: 'asc' }
      ],
      take: 25
    });

    const choices = sounds.map(sound => ({
      name: `${sound.name} (${sound.person}) [${sound.category}]`,
      value: sound.name
    }));

    await interaction.respond(choices);
  } catch (error) {
    console.error('Error in reactions autocomplete:', error);
    await interaction.respond([]);
  }
}