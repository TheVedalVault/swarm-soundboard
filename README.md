# 🎵 Swarm Soundboard Bot

A Discord bot for playing Vedalverse sound clips with interactive features and server management tools.

## 🚀 Quick Start

1. **Add sounds**: Place `.mp3` files in the `sounds/` folder
2. **Register sounds**: `node addSound.js "sound name" "filename.mp3" "category" "person"`
3. **Play sounds**: `/play <sound name>` (with autocomplete!)
4. **React to play**: Set up emoji reactions with `/reactions add`

---

## 📋 All Commands (11 total)

### 🎵 **Playing Sounds**

**`/play <sound>`**
- Play any sound by name with smart autocomplete
- Shows queue position if busy
- Respects server queue limits

**`/random [category] [person]`**
- Play random sounds with optional filtering
- Examples: `/random`, `/random category:cursed`, `/random person:vedal category:reactions`

**`/vedal [mode]`**
- Quick access to random Vedal sounds
- Modes: random, reactions, screams, cursed, misc

### **Queue Management**

**`/queue show`** - Display current sound queue
**`/queue clear`** - Clear the entire queue
**`/stop`** - Stop current sound and clear queue
**`/leave`** - Bot leaves voice channel
**`/volume [level]`** - Set/check volume (0.1-1.0)

### **React-to-Play System**

**`/reactions add <emoji> <sound>`** - Map emoji (or custom Discord emote) to sound
**`/reactions remove <emoji>`** - Remove emoji mapping
**`/reactions list`** - Show all current mappings
**`/reactions toggle <enabled>`** - Enable/disable react-to-play

*How it works*: React with mapped emote to any message → bot plays the mapped sound instantly!

### **Browsing & Discovery**

**`/sounds list [page]`** - Browse all sounds (paginated)
**`/sounds by-person <person>`** - Filter by Vedal, Neuro, Evil, etc.
**`/sounds by-category <category>`** - Filter by cursed, reactions, screams, misc
**`/sounds popular [limit]`** - Most played sounds
**`/sounds search <query>`** - Search sounds by name
**`/sounds stats`** - Library overview with breakdowns

### **Statistics & Leaderboards**

**`/stats server`** - Server statistics and top sounds
**`/stats global`** - Cross-server statistics  
**`/stats user [target]`** - Personal or other user's stats
**`/stats leaderboard [type]`** - Multiple leaderboard types:
- Most Active Users
- Most Popular Sounds
- Most Used Categories
- Most Popular People

### **Server Administration** *(Admin Only)*

**`/server config`** - View all server settings
**`/server queue-limit <size>`** - Set max queue size (1-50)
**`/server volume <level>`** - Set default server volume
**`/server toggle-category <category> <enabled>`** - Enable/disable categories
**`/server toggle-person <person> <enabled>`** - Enable/disable people
**`/server restrict-roles <roles>`** - Limit bot usage to specific roles

---

## Key Features

### **Smart Audio System**
- **Queue vs Reactions**: Commands use organized queue, reactions interrupt immediately
- **Priority System**: Reactions jump to front of queue for instant gratification
- **Queue Limits**: Admins can prevent queue spam (default: 10 sounds)
- **Autocomplete**: Type `/play` and get suggestions with popularity ranking

### **React-to-Play Magic**
- **Any Emoji**: Map 😂, 🐢, ⭐, custom emojis to sounds
- **Instant Response**: React to any message → sound plays immediately
- **Server-Specific**: Each server has its own emoji mappings
- **Priority Playback**: Reactions interrupt current sounds but preserve queue

### **Comprehensive Stats**
- **User Competition**: See who's most active, what they play most
- **Sound Popularity**: Track which sounds are community favorites  
- **Server Insights**: Compare categories, people, recent activity
- **Global View**: Cross-server statistics and trends

### **Admin Control**
- **Granular Permissions**: Control categories, people, individual sounds
- **Queue Management**: Set limits to prevent spam
- **Role Restrictions**: Limit usage to trusted roles
- **Volume Control**: Set server-wide default volume

---

## 🎪 Advanced Usage

### **Setting Up React-to-Play**
```
1. /reactions add 😂 "vedal laugh"
2. /reactions add 🐢 "turtle noise"  
3. /reactions add ⭐ "neuro scream"
4. React to any message with those emojis!
```

### **Server Configuration Example**
```
/server queue-limit 5          # Prevent long queues
/server toggle-category cursed false  # Disable cursed sounds
/server restrict-roles "Trusted Member"  # Limit to specific role
/server volume 0.7             # Set comfortable volume
```

### **Finding Sounds**
- **Browse**: `/sounds by-person vedal` → see all Vedal sounds
- **Search**: `/sounds search laugh` → find sounds with "laugh"
- **Popular**: `/sounds popular` → see community favorites
- **Autocomplete**: Type `/play` and start typing for suggestions!

---

## Statistics Examples

**Server Stats**: Total plays, active users, top sounds, category breakdowns
**User Stats**: Personal favorites, play counts, recent activity
**Leaderboards**: Most active users, popular sounds, category usage
**Global Stats**: Cross-server trends and most popular content

---

## Technical Features

- **11 comprehensive slash commands** with rich Discord embeds
- **SQLite database** with play history and server configurations  
- **Priority queue system** balancing organized play with spontaneous reactions
- **Smart autocomplete** with popularity-based suggestions
- **Granular permissions** for server administrators
- **Real-time statistics** and competitive leaderboards

---

## Future Ideas

- **Bigger Variety**: Add more categories and people
- **Web Interface**: Community sound submissions and voting
- **Starboard Integration**: Auto-add popular sounds from starboard
- **Playlist Mode**: Continuous playback with shuffle/repeat
- **Advanced Analytics**: Usage patterns and engagement metrics

---

## 🤝 **Feedback Welcome!**

What features would you like to see?