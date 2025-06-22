const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
// Mengambil port dari variabel lingkungan Azure, default 3000 untuk lokal
const PORT = process.env.PORT || 3000;
// Path ke file users.json di server Azure
const DATABASE_FILE = path.join(__dirname, 'users.json');

// Mengambil kunci admin dari variabel lingkungan Azure
const SECRET_ADMIN_KEY = process.env.ADMIN_KEY || 'supersecretadminpassword123'; // PENTING: Ganti dengan kunci kuat untuk produksi

// Middleware untuk mem-parsing JSON body dari request
app.use(bodyParser.json());

// --- Fungsi Database (menggunakan users.json lokal di server App Service) ---
function loadUsers() {
    try {
        if (fs.existsSync(DATABASE_FILE)) {
            const data = fs.readFileSync(DATABASE_FILE, 'utf8');
            const users = JSON.parse(data);
            for (const username in users) {
                if (users.hasOwnProperty(username) && !users[username].hasOwnProperty('credit')) {
                    users[username].credit = 0;
                }
            }
            return users;
        }
    } catch (error) {
        console.error("Error loading users data:", error.message);
    }
    return {};
}

function saveUsers(users) {
    try {
        fs.writeFileSync(DATABASE_FILE, JSON.stringify(users, null, 2), 'utf8');
    } catch (error) {
        console.error("Error saving users data:", error.message);
    }
}

// --- API Endpoint untuk Register ---
app.post('/register', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    let users = loadUsers();

    if (users[username]) {
        return res.status(409).json({ success: false, message: 'Username already exists.' });
    }

    // PENTING: Dalam produksi, gunakan hashing password seperti bcrypt sebelum menyimpan!
    users[username] = { password: password, credit: 0 };
    saveUsers(users);

    res.status(201).json({ success: true, message: 'User registered successfully.' });
});

// --- API Endpoint untuk Login ---
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    let users = loadUsers();
    const user = users[username];

    if (!user || user.password !== password) { // PENTING: Dalam produksi, bandingkan dengan password yang di-hash!
        return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    res.status(200).json({ success: true, message: 'Login successful.', username: user.username });
});

// --- API Endpoint untuk Menambah Kredit (Admin) ---
app.post('/admin/add-credit', (req, res) => {
    const { username, amount, adminKey } = req.body;

    if (adminKey !== SECRET_ADMIN_KEY) {
        return res.status(403).json({ success: false, message: 'Unauthorized: Invalid admin key' });
    }

    if (!username || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid input: username and positive amount are required.' });
    }

    let users = loadUsers();

    if (users[username]) {
        users[username].credit += amount;
        saveUsers(users);
        res.status(200).json({
            success: true,
            message: `Successfully added ${amount} credit to ${username}.`,
            newBalance: users[username].credit
        });
    } else {
        res.status(404).json({ success: false, message: 'User not found.' });
    }
});

// --- API Endpoint untuk Cek Kredit ---
app.get('/user/:username/credit', (req, res) => {
    const username = req.params.username;
    let users = loadUsers();
    const user = users[username];

    if (user) {
        res.status(200).json({
            success: true,
            username: user.username,
            credit: user.credit
        });
    } else {
        res.status(404).json({ success: false, message: 'User not found.' });
    }
});

// Mulai server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`To register (POST): /register`);
    console.log(`To login (POST): /login`);
    console.log(`To add credit (POST): /admin/add-credit`);
    console.log(`To check credit (GET): /user/:username/credit`);
});
