const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

let sock;
let isConnected = false;

async function connectToWhatsApp() {
    try {
        console.log('🔄 Initializing WhatsApp connection...');
        const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
        console.log('✅ Auth state loaded.');

        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' })
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('\n📲 Scan this QR code with your WhatsApp app:');
                qrcode.generate(qr, { small: true });
            }

            if (connection === 'close') {
                isConnected = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                console.log(`❌ WhatsApp disconnected (code: ${statusCode}). Reconnecting: ${shouldReconnect}`);
                if (shouldReconnect) {
                    connectToWhatsApp();
                } else {
                    console.log('🔒 Logged out. Delete baileys_auth_info folder and restart to re-link.');
                }
            } else if (connection === 'open') {
                isConnected = true;
                console.log('✅ WhatsApp is connected and ready to send messages!');
            }
        });
    } catch (err) {
        console.error('❌ Failed to initialize WhatsApp:', err);
    }
}

async function sendWhatsAppMessage(phoneNumber, messageText) {
    if (!sock || !isConnected) {
        throw new Error('WhatsApp is not connected. Please scan the QR code first.');
    }
    if (!phoneNumber) {
        throw new Error('Phone number is required.');
    }

    // Clean and format to 8801XXXXXXXXX@s.whatsapp.net
    let cleanNumber = String(phoneNumber).replace(/\D/g, '');
    if (cleanNumber.startsWith('01') && cleanNumber.length === 11) {
        cleanNumber = '88' + cleanNumber;
    } else if (cleanNumber.startsWith('1') && cleanNumber.length === 10) {
        cleanNumber = '880' + cleanNumber;
    }

    const jid = `${cleanNumber}@s.whatsapp.net`;
    console.log(`📤 Sending WhatsApp message to ${jid}...`);

    await sock.sendMessage(jid, { text: messageText });
    console.log(`✅ Message sent successfully to ${jid}`);
}

function getConnectionStatus() {
    return isConnected;
}

module.exports = { connectToWhatsApp, sendWhatsAppMessage, getConnectionStatus };