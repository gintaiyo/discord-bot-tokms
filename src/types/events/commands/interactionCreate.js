const {
  Client,
  InteractionType,
} = require("discord.js");

module.exports = {
  name: "interactionCreate",

  /**
   * @param {Client} client
   * @param {*} interaction
   */
  async execute(interaction, client) {
    
    // ===========================
    // 1️⃣ SLASH COMMANDS
    // ===========================
    if (interaction.isChatInputCommand() || interaction.isUserContextMenuCommand()) {
      const { commands } = client;
      const command = commands.get(interaction.commandName);

      if (!command) return;

      try {
        await command.execute(interaction, client);
      } catch (err) {
        console.error(err);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "❌ Something went wrong executing this command.",
            ephemeral: true,
          });
        }
      }
      return;
    }

    // ===========================
    // 2️⃣ BUTTONS
    // ===========================
    if (interaction.isButton()) {
  const { buttons } = client;

  const button = [...buttons.values()].find(b => interaction.customId.startsWith(b.customId));

  if (!button) {
    console.log(`❌ No handler for button: ${interaction.customId}`);
    return;
  }

  try {
    await button.execute(interaction, client);
  } catch (err) {
    console.error(err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Error executing button.",
        ephemeral: true,
      });
    }
  }
}


    // ===========================
// 3️⃣ MODALS
// ===========================
if (interaction.type === InteractionType.ModalSubmit) {
  const { modals } = client;

  const [baseId] = interaction.customId.split(":");
  const modal = modals.get(baseId);

  if (!modal) {
    console.log(`❌ No modal handler for: ${interaction.customId}`);
    return;
  }

  try {
    await modal.execute(interaction, client);
  } catch (err) {
    console.error(err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Error executing modal.",
        ephemeral: true,
      });
    }
  }

  return;
}


    // ===========================
    // 4️⃣ SELECT MENUS
    // ===========================
    if (interaction.isStringSelectMenu()) {
      const { selectMenus } = client;

      const [baseId] = interaction.customId.split(":");
      const menu = selectMenus.get(baseId);

      if (!menu) return console.log(`❌ No menu handler for: ${interaction.customId}`);

      try {
        await menu.execute(interaction, client);
      } catch (err) {
        console.error(err);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "❌ Error executing select menu.",
            ephemeral: true,
          });
        }
      }

      return;
    }
  },
};
