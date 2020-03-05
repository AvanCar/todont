const express = require('express');
const app     = express();
const path    = require('path');
const createDAO   = require('./Models/dao');
const TodontModel = require('./Models/TodontModel');
const UserModel   = require('./Models/UserModel');
const AuthController = require('./Controllers/AuthController');

const dbFilePath = process.env.DB_FILE_PATH || path.join(__dirname, 'Database', 'Todont.db');
let Todont = undefined;
let Auth = undefined;

// Gives direct access to GET files from the
// "public" directory (you can name the directory anything)
app.use(express.static('public'));

// We need this line so express can parse the POST data the browser
// automatically sends
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Default route
app.get('/', (req, res) => {
    console.log(req.ip);
    res.redirect('/todont_list');
});

app.get("/todont_list", (req, res) => {
    res.sendFile(path.join(__dirname, '/public/html/todont.html'));
});

app.get("/todont_items", (req, res) => {
    Todont.getAll()
        .then( (rows) => {
            console.log(rows);
            // remember to change index.js
            res.send(JSON.stringify({todont_items: rows}));
        })
        .catch( err => {
            console.error(err);
            res.sendStatus(500);
        })
});

app.post("/add_todont", (req, res) => {
    const data = req.body;
    console.log(data);
    Todont.add(data.text, data.priority)
        .then( () => {
            res.sendStatus(200);
        }).catch( err => {
            console.error(err);
            res.sendStatus(500);
        });
});

app.get("/register", async (req, res) => {
    res.sendFile(path.join(__dirname, "public", "html", "register.html"));
});

app.post("/register", async (req, res) => {
    const body = req.body;
    console.log(body);
    if (body === undefined || (!body.username || !body.password)) {
        return res.sendStatus(400);
    }
    const {username, password} = body;
    try {
        await Auth.register(username, password);
        res.sendStatus(200);
    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    }
});

// Listen on port 80 (Default HTTP port)
app.listen(80, async () => {
    // wait until the db is initialized and all models are initialized
    await initDB();
    // Then log that the we're listening on port 80
    console.log("Listening on port 80.");
});

async function initDB () {
    const dao = await createDAO(dbFilePath);
    Todont = new TodontModel(dao);
    await Todont.createTable();
    Users = new UserModel(dao);
    await Users.createTable();
    Auth = new AuthController(dao);
}