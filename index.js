const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const qrcode = require("qrcode"); // buat convert QR string ke gambar
const pino = require("pino");
const handler = require("./handler");

// =====================
async function startBot() {

    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        auth: state,
        printQRInTerminal: false // ❗ MATIIN AUTO QR
    });

    // =====================
    // QR MANUAL
    // =====================
    sock.ev.on("connection.update", async (update) => {

        const { connection, lastDisconnect, qr } = update;

        // 🔥 QR DAPAT DI SINI
        if (qr) {
            console.log("📲 QR BARU TERDETEK!");

            // tampilkan di terminal (opsional)
            const qrImage = await qrcode.toString(qr, { type: "terminal" });
            console.log(qrImage);

            // kalau mau simpan jadi file PNG:
            await qrcode.toFile("./qrcode.png", qr);

            console.log("✅ QR disimpan ke qrcode.png");
        }

        if (connection === "open") {
            console.log("✅ Bot connected!");
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;

            if (reason !== DisconnectReason.loggedOut) {
                console.log("🔄 Reconnecting...");
                startBot();
            } else {
                console.log("❌ Session logout, scan ulang QR");
            }
        }
    });

    // =====================
    // SAVE SESSION
    // =====================
    sock.ev.on("creds.update", saveCreds);

    // =====================
    // MESSAGE HANDLER
    // =====================
    sock.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message) return;

            const from = msg.key.remoteJid;
            const sender = msg.key.participant || msg.key.remoteJid;

            const text =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                msg.message?.imageMessage?.caption ||
                "";

            // 🔥 LOG KE CONSOLE
            console.log(`
    📩 PESAN MASUK
    👤 Dari: ${sender}
    📍 Grup: ${from}
    💬 Pesan: ${text}
    ------------------------`);

            await handler(sock, msg);

        } catch (err) {
            console.log("❌ ERROR:", err);
        }
    });
}

startBot();
