const { Client } = require('discord.js');

/** 
 * @param { Client } client
 */
function loadComponents(client) {
    const ascii = require('ascii-table');
    const fs = require('fs');
    const table = new ascii().setHeading("Components", "Type", "Status");

    const componentFolder = fs.readdirSync(`./src/types/components`);
    for (const folder of componentFolder) {
        const componentFiles = fs.readdirSync(`./src/types/components/${folder}`).filter(file => file.endsWith('.js'));

        const { modals, buttons, selectMenus } = client; // Added selectMenus
        
        switch (folder) {
            case "buttons": {
                for (const file of componentFiles) {
                    const button = require(`../types/components/${folder}/${file}`);
                    buttons.set(button.customId, button);
                    table.addRow(file, "button", "✅");
                }
            }
            break;

            case "modals": {
    for (const file of componentFiles) {
        const modal = require(`../types/components/${folder}/${file}`);

        if (!modal.customId) {
            table.addRow(file, "modal", "❌ (no customId)");
            continue;
        }

        modals.set(modal.customId, modal);
        table.addRow(file, "modal", "✅");
    }
}
break;


            case "selectMenus": { // New case for select menus
    for (const file of componentFiles) {
        const selectMenu = require(`../types/components/${folder}/${file}`);

        if (!selectMenu.customId) {
            table.addRow(file, "select-menu", "❌ (no customId)");
            continue;
        }

        selectMenus.set(selectMenu.customId, selectMenu);
        table.addRow(file, "select-menu", "✅");
    }
}
break;


            
            default:
                break;
        }
    }

    return console.log(table.toString(), "\nLoaded Components!");
}

module.exports = { loadComponents };
