import dotenv from 'dotenv';
import { deployCommands } from './src/utils/commandLoader.js';

dotenv.config();

async function deployCommandsManually() {
  console.log('🚀 Manual Command Deployment');
  console.log('============================');
  
  if (!process.env.CLIENT_ID || !process.env.TOKEN) {
    console.error('❌ Missing CLIENT_ID or TOKEN in .env file');
    process.exit(1);
  }

  try {
    if (process.env.GUILD_ID) {
      console.log(`📍 Deploying to guild: ${process.env.GUILD_ID}`);
      await deployCommands(process.env.CLIENT_ID, process.env.TOKEN, process.env.GUILD_ID);
    } else {
      console.log('🌍 Deploying globally');
      await deployCommands(process.env.CLIENT_ID, process.env.TOKEN);
    }
    
    console.log('✅ Commands deployed successfully!');
  } catch (error) {
    console.error('❌ Failed to deploy commands:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('1. Check that CLIENT_ID and TOKEN are correct');
    console.log('2. Verify you own the Discord application');
    console.log('3. Ensure the bot has applications.commands scope');
    console.log('4. Try deploying to a specific guild first (set GUILD_ID in .env)');
  }
}

deployCommandsManually();
