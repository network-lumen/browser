const { ipcMain, app } = require('electron');
const fs = require('fs').promises;
const path = require('path');

const ADDRESSBOOK_FILE = 'addressbook.json';

/**
 * Get the path to the address book file
 */
function getAddressBookPath() {
  const userData = app.getPath('userData');
  return path.join(userData, ADDRESSBOOK_FILE);
}

/**
 * Load all contacts from the address book
 */
async function loadContacts() {
  try {
    const filePath = getAddressBookPath();
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

/**
 * Save contacts to the address book
 */
async function saveContacts(contacts) {
  const filePath = getAddressBookPath();
  await fs.writeFile(filePath, JSON.stringify(contacts, null, 2), 'utf8');
  return true;
}

/**
 * Register IPC handlers
 */
function registerHandlers() {
  // Get all contacts
  ipcMain.handle('addressbook:list', async () => {
    try {
      const contacts = await loadContacts();
      return { ok: true, contacts };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // Add a new contact
  ipcMain.handle('addressbook:add', async (_event, contact) => {
    try {
      const contacts = await loadContacts();
      
      // Validate
      if (!contact.name || !contact.address) {
        return { ok: false, error: 'Name and address are required' };
      }

      // Check for duplicate address
      if (contacts.some(c => c.address === contact.address)) {
        return { ok: false, error: 'Address already exists' };
      }

      // Add new contact with timestamp
      const newContact = {
        id: Date.now().toString(),
        name: contact.name,
        address: contact.address,
        note: contact.note || '',
        createdAt: new Date().toISOString()
      };

      contacts.push(newContact);
      await saveContacts(contacts);

      return { ok: true, contact: newContact };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // Update a contact
  ipcMain.handle('addressbook:update', async (_event, id, updates) => {
    try {
      const contacts = await loadContacts();
      const index = contacts.findIndex(c => c.id === id);

      if (index === -1) {
        return { ok: false, error: 'Contact not found' };
      }

      // Update fields
      contacts[index] = {
        ...contacts[index],
        name: updates.name || contacts[index].name,
        address: updates.address || contacts[index].address,
        note: updates.note !== undefined ? updates.note : contacts[index].note,
        updatedAt: new Date().toISOString()
      };

      await saveContacts(contacts);
      return { ok: true, contact: contacts[index] };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // Delete a contact
  ipcMain.handle('addressbook:delete', async (_event, id) => {
    try {
      const contacts = await loadContacts();
      const filtered = contacts.filter(c => c.id !== id);

      if (filtered.length === contacts.length) {
        return { ok: false, error: 'Contact not found' };
      }

      await saveContacts(filtered);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

module.exports = { registerHandlers };
