const { Client, Events, GatewayIntentBits } = require('discord.js');

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('DISCORD_TOKEN が設定されていません。.env にトークンを貼ってください。');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Developer Portal で ON にしたもの
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`ログインしました: ${c.user.tag}`);
});

// 動作確認用: 「ping」と送ると「pong」と返す
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (message.content === 'ping') {
    await message.reply('pong');
  }
});

client.login(token);
