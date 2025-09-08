import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AutocompleteInteraction, GuildMember, VoiceChannel } from 'discord.js';
import { prisma } from '../services/database.js';
import { audioManager } from '../services/audioManager.js';

export const data = new SlashCommandBuilder()
  .setName('favorites')
  .setDescription('Manage your personal favorite sounds')
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Add a sound to your favorites')
      .addStringOption(option =>
        option.setName('sound')
          .setDescription('The sound to add to favorites')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Remove a sound from your favorites')
      .addStringOption(option =>
        option.setName('sound')
          .setDescription('The sound to remove from favorites')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('Show your favorite sounds')
      .addIntegerOption(option =>
        option.setName('page')
          .setDescription('Page number (default: 1)')
          .setMinValue(1)
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('play')
      .setDescription('Play a random sound from your favorites')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('clear')
      .setDescription('Remove all sounds from your favorites')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
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
      case 'play':
        await handlePlay(interaction);
        break;
      case 'clear':
        await handleClear(interaction);
        break;
      default:
        await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
    }
  } catch (error) {
    console.error('Error in favorites command:', error);
    await interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
  }
}

async function handleAdd(interaction: ChatInputCommandInteraction) {
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
    // Check if already in favorites
    const existing = await prisma.userFavorite.findUnique({
      where: {
        userId_soundId: {
          userId: interaction.user.id,
          soundId: sound.id
        }
      }
    });

    if (existing) {
      await interaction.reply({ content: `❌ **${sound.name}** is already in your favorites!`, ephemeral: true });
      return;
    }

    // Add to favorites
    await prisma.userFavorite.create({
      data: {
        userId: interaction.user.id,
        soundId: sound.id
      }
    });

    await interaction.reply(`⭐ Added **${sound.name}** to your favorites!`);
  } catch (error) {
    console.error('Error adding favorite:', error);
    await interaction.reply({ content: 'Failed to add sound to favorites.', ephemeral: true });
  }
}

async function handleRemove(interaction: ChatInputCommandInteraction) {
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
    const deleted = await prisma.userFavorite.deleteMany({
      where: {
        userId: interaction.user.id,
        soundId: sound.id
      }
    });

    if (deleted.count > 0) {
      await interaction.reply(`💔 Removed **${sound.name}** from your favorites.`);
    } else {
      await interaction.reply({ content: `❌ **${sound.name}** is not in your favorites!`, ephemeral: true });
    }
  } catch (error) {
    console.error('Error removing favorite:', error);
    await interaction.reply({ content: 'Failed to remove sound from favorites.', ephemeral: true });
  }
}

async function handleList(interaction: ChatInputCommandInteraction) {
  const page = interaction.options.getInteger('page') || 1;
  const pageSize = 10;
  const offset = (page - 1) * pageSize;

  const [favorites, totalCount] = await Promise.all([
    prisma.userFavorite.findMany({
      where: { userId: interaction.user.id },
      include: { sound: true },
      orderBy: { addedAt: 'desc' },
      skip: offset,
      take: pageSize
    }),
    prisma.userFavorite.count({
      where: { userId: interaction.user.id }
    })
  ]);

  if (totalCount === 0) {
    await interaction.reply('⭐ You haven\'t added any favorites yet! Use `/favorites add` to get started.');
    return;
  }

  const totalPages = Math.ceil(totalCount / pageSize);
  
  const embed = new EmbedBuilder()
    .setTitle('⭐ Your Favorite Sounds')
    .setColor(0xFFD700)
    .setDescription(
      favorites.map((fav: any, index: number) => 
        `${offset + index + 1}. **${fav.sound.name}** (${fav.sound.person}) [${fav.sound.category}]`
      ).join('\n')
    )
    .setFooter({ 
      text: `Page ${page}/${totalPages} • ${totalCount} favorite(s) total` 
    });

  await interaction.reply({ embeds: [embed] });
}

async function handlePlay(interaction: ChatInputCommandInteraction) {
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

  // Get user's favorites
  const favorites = await prisma.userFavorite.findMany({
    where: { userId: interaction.user.id },
    include: { sound: true }
  });

  if (favorites.length === 0) {
    await interaction.reply({ content: '⭐ You don\'t have any favorites yet! Use `/favorites add` to add some.', ephemeral: true });
    return;
  }

  // Pick a random favorite
  const randomFavorite = favorites[Math.floor(Math.random() * favorites.length)];
  
  try {
    // Join voice channel if not already connected
    await audioManager.joinChannel(voiceChannel as VoiceChannel);

    // Play the sound directly using audioManager
    const success = await audioManager.playSound(
      interaction.guild.id, 
      randomFavorite.sound.name, 
      interaction.user.id, 
      false
    );

    if (success) {
      const queueLength = audioManager.getQueue(interaction.guild.id).length;
      if (queueLength > 1) {
        await interaction.reply(`⭐ Playing random favorite: **${randomFavorite.sound.name}** (position ${queueLength} in queue)`);
      } else {
        await interaction.reply(`⭐ Playing random favorite: **${randomFavorite.sound.name}**`);
      }
    } else {
      await interaction.reply({ content: `❌ Failed to play "${randomFavorite.sound.name}". The sound file might be missing.`, ephemeral: true });
    }
  } catch (error) {
    console.error('Error in favorites play:', error);
    await interaction.reply({ content: 'An error occurred while trying to play your favorite sound.', ephemeral: true });
  }
}

async function handleClear(interaction: ChatInputCommandInteraction) {
  const count = await prisma.userFavorite.count({
    where: { userId: interaction.user.id }
  });

  if (count === 0) {
    await interaction.reply({ content: '⭐ You don\'t have any favorites to clear!', ephemeral: true });
    return;
  }

  await prisma.userFavorite.deleteMany({
    where: { userId: interaction.user.id }
  });

  await interaction.reply(`🗑️ Cleared all ${count} favorite(s) from your list.`);
}

export async function autocomplete(interaction: AutocompleteInteraction) {
  const subcommand = interaction.options.getSubcommand();
  const focusedValue = interaction.options.getFocused().toLowerCase();
  
  try {
    if (subcommand === 'add') {
      // Show sounds not in favorites
      const userFavorites = await prisma.userFavorite.findMany({
        where: { userId: interaction.user.id },
        select: { soundId: true }
      });
      
      const favoriteSoundIds = userFavorites.map((fav: any) => fav.soundId);
      
      const sounds = await prisma.sound.findMany({
        where: {
          name: { contains: focusedValue },
          id: { notIn: favoriteSoundIds }
        },
        orderBy: [
          { playCount: 'desc' },
          { name: 'asc' }
        ],
        take: 25
      });

      const choices = sounds.map((sound: any) => ({
        name: `${sound.name} (${sound.person}) [${sound.category}]`,
        value: sound.name
      }));

      await interaction.respond(choices);
    } else if (subcommand === 'remove') {
      // Show only user's favorites
      const favorites = await prisma.userFavorite.findMany({
        where: { userId: interaction.user.id },
        include: { sound: true }
      });

      const filteredFavorites = favorites.filter((fav: any) => 
        fav.sound.name.toLowerCase().includes(focusedValue)
      );

      const choices = filteredFavorites.slice(0, 25).map((fav: any) => ({
        name: `${fav.sound.name} (${fav.sound.person}) [${fav.sound.category}]`,
        value: fav.sound.name
      }));

      await interaction.respond(choices);
    }
  } catch (error) {
    console.error('Error in favorites autocomplete:', error);
    await interaction.respond([]);
  }
}
