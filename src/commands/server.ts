import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { prisma } from '../services/database.js';

export const data = new SlashCommandBuilder()
  .setName('server')
  .setDescription('Manage server-specific soundboard settings')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(subcommand =>
    subcommand
      .setName('config')
      .setDescription('View current server configuration')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('queue-limit')
      .setDescription('Set maximum queue size')
      .addIntegerOption(option =>
        option.setName('size')
          .setDescription('Maximum number of sounds in queue (1-50)')
          .setMinValue(1)
          .setMaxValue(50)
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('volume')
      .setDescription('Set default server volume')
      .addNumberOption(option =>
        option.setName('level')
          .setDescription('Volume level (0.1 to 1.0)')
          .setMinValue(0.1)
          .setMaxValue(1.0)
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('toggle-category')
      .setDescription('Enable or disable a sound category')
      .addStringOption(option =>
        option.setName('category')
          .setDescription('Category to toggle')
          .setRequired(true)
          .addChoices(
            { name: 'Cursed Sounds', value: 'cursed' },
            { name: 'Reactions', value: 'reactions' },
            { name: 'Screams', value: 'screams' },
            { name: 'Miscellaneous', value: 'misc' }
          )
      )
      .addBooleanOption(option =>
        option.setName('enabled')
          .setDescription('Enable this category')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('toggle-person')
      .setDescription('Enable or disable sounds from a person')
      .addStringOption(option =>
        option.setName('person')
          .setDescription('Person to toggle')
          .setRequired(true)
          .addChoices(
            { name: 'Vedal', value: 'vedal' },
            { name: 'Neuro', value: 'neuro' },
            { name: 'Evil', value: 'evil' },
            { name: 'Camila', value: 'camila' },
            { name: 'Cerber', value: 'cerber' },
            { name: 'Mini', value: 'mini' },
            { name: 'Miscellaneous', value: 'misc' }
          )
      )
      .addBooleanOption(option =>
        option.setName('enabled')
          .setDescription('Enable sounds from this person')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('restrict-roles')
      .setDescription('Restrict soundboard usage to specific roles (empty = everyone)')
      .addStringOption(option =>
        option.setName('roles')
          .setDescription('Comma-separated role names or IDs (leave empty to allow everyone)')
          .setRequired(false)
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
      case 'config':
        await handleConfig(interaction);
        break;
      case 'queue-limit':
        await handleQueueLimit(interaction);
        break;
      case 'volume':
        await handleVolume(interaction);
        break;
      case 'toggle-category':
        await handleToggleCategory(interaction);
        break;
      case 'toggle-person':
        await handleTogglePerson(interaction);
        break;
      case 'restrict-roles':
        await handleRestrictRoles(interaction);
        break;
      default:
        await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
    }
  } catch (error) {
    console.error('Error in server command:', error);
    await interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
  }
}

async function handleConfig(interaction: ChatInputCommandInteraction) {
  const config = await prisma.serverConfig.findUnique({
    where: { guildId: interaction.guild!.id }
  });

  const enabledCategories = config?.enabledCategories?.split(',') || ['cursed', 'reactions', 'screams', 'misc'];
  const enabledPeople = config?.enabledPeople?.split(',') || ['vedal', 'neuro', 'evil', 'camila', 'cerber', 'mini', 'misc'];
  const volume = config?.volume || 0.5;
  const maxQueueSize = config?.maxQueueSize || 10;
  const reactToPlayEnabled = config?.reactToPlayEnabled ?? true;
  const allowedRoles = config?.allowedRoles || '';

  const embed = new EmbedBuilder()
    .setTitle('🛠️ Server Configuration')
    .setColor(0x00AE86)
    .addFields(
      { name: '🔊 Volume', value: `${Math.round(volume * 100)}%`, inline: true },
      { name: '📋 Queue Limit', value: maxQueueSize.toString(), inline: true },
      { name: '🎭 React-to-Play', value: reactToPlayEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
      { name: '📂 Enabled Categories', value: enabledCategories.join(', ') || 'None', inline: false },
      { name: '👥 Enabled People', value: enabledPeople.join(', ') || 'None', inline: false },
      { name: '🔒 Role Restrictions', value: allowedRoles || 'None (everyone can use)', inline: false }
    );

  await interaction.reply({ embeds: [embed] });
}

async function handleQueueLimit(interaction: ChatInputCommandInteraction) {
  const size = interaction.options.getInteger('size', true);

  await prisma.serverConfig.upsert({
    where: { guildId: interaction.guild!.id },
    update: { maxQueueSize: size },
    create: { 
      guildId: interaction.guild!.id,
      maxQueueSize: size
    }
  });

  await interaction.reply(`✅ Queue limit set to **${size}** sounds!`);
}

async function handleVolume(interaction: ChatInputCommandInteraction) {
  const level = interaction.options.getNumber('level', true);

  await prisma.serverConfig.upsert({
    where: { guildId: interaction.guild!.id },
    update: { volume: level },
    create: { 
      guildId: interaction.guild!.id,
      volume: level
    }
  });

  await interaction.reply(`🔊 Server volume set to **${Math.round(level * 100)}%**!`);
}

async function handleToggleCategory(interaction: ChatInputCommandInteraction) {
  const category = interaction.options.getString('category', true);
  const enabled = interaction.options.getBoolean('enabled', true);

  const config = await prisma.serverConfig.findUnique({
    where: { guildId: interaction.guild!.id }
  });

  const currentCategories = config?.enabledCategories?.split(',') || ['cursed', 'reactions', 'screams', 'misc'];
  
  let updatedCategories: string[];
  if (enabled) {
    updatedCategories = [...new Set([...currentCategories, category])];
  } else {
    updatedCategories = currentCategories.filter(c => c !== category);
  }

  await prisma.serverConfig.upsert({
    where: { guildId: interaction.guild!.id },
    update: { enabledCategories: updatedCategories.join(',') },
    create: { 
      guildId: interaction.guild!.id,
      enabledCategories: updatedCategories.join(',')
    }
  });

  const status = enabled ? 'enabled' : 'disabled';
  await interaction.reply(`✅ **${category}** category ${status}!`);
}

async function handleTogglePerson(interaction: ChatInputCommandInteraction) {
  const person = interaction.options.getString('person', true);
  const enabled = interaction.options.getBoolean('enabled', true);

  const config = await prisma.serverConfig.findUnique({
    where: { guildId: interaction.guild!.id }
  });

  const currentPeople = config?.enabledPeople?.split(',') || ['vedal', 'neuro', 'evil', 'camila', 'cerber', 'mini', 'misc'];
  
  let updatedPeople: string[];
  if (enabled) {
    updatedPeople = [...new Set([...currentPeople, person])];
  } else {
    updatedPeople = currentPeople.filter(p => p !== person);
  }

  await prisma.serverConfig.upsert({
    where: { guildId: interaction.guild!.id },
    update: { enabledPeople: updatedPeople.join(',') },
    create: { 
      guildId: interaction.guild!.id,
      enabledPeople: updatedPeople.join(',')
    }
  });

  const status = enabled ? 'enabled' : 'disabled';
  await interaction.reply(`✅ **${person}** sounds ${status}!`);
}

async function handleRestrictRoles(interaction: ChatInputCommandInteraction) {
  const roles = interaction.options.getString('roles') || '';

  await prisma.serverConfig.upsert({
    where: { guildId: interaction.guild!.id },
    update: { allowedRoles: roles },
    create: { 
      guildId: interaction.guild!.id,
      allowedRoles: roles
    }
  });

  if (roles) {
    await interaction.reply(`🔒 Soundboard restricted to roles: **${roles}**`);
  } else {
    await interaction.reply(`🔓 Soundboard restrictions removed - everyone can use it!`);
  }
}