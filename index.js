const express        = require('express');
const app            = express();
const path           = require('path');
const createDAO      = require('./Models/dao');
const TodontModel    = require('./Models/TodontModel');
const UserModel      = require('./Models/UserModel');
const AuthController = require('./Controllers/AuthController');
const winston        = require('winston');

/*
        Initialize logger
*/
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.json(),
    ),
    transports: [
      new winston.transports.File({ filename: './logs/error.log', level: 'error' }),
      new winston.transports.File({ filename: './logs/info.log' })
    ]
});

const dbFilePath = process.env.DB_FILE_PATH || path.join(__dirname, 'Database', 'Todont.db');
let Todont = undefined;
let Auth   = undefined;

// Gives direct access to GET files from the
// "public" directory (you can name the directory anything)
app.use(express.static('public'));

// We add this to the middleware so it logs every request
// don't do this in production since it will log EVERYTHING (including passwords)
app.use((req, res, next) => {
    logger.info(`${req.ip}|${req.method}|${req.body || ""}|${req.originalUrl}`);
    next();
});

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

/*
        Getting Todont items
        all and filtering
*/
app.get("/todont_items", errorHandler(async (req, res) => {
    const rows = await Todont.getAll();
    res.send(JSON.stringify({todont_items: rows}));
}));

app.get("/todonts/:priority", errorHandler(async (req, res) => {
    const priority = req.params.priority;
    const validPriorities = ['Normal', 'Low', 'High'];
    if (!validPriorities.includes(priority)) {
        return res.sendStatus(400);
    }
    const rows = await Todont.getAllWithPriority(priority);
    res.send(JSON.stringify({todont_items: rows}));
}));

/*
        Adding todonts
*/
app.post("/add_todont", errorHandler( async (req, res) => {
    const data = req.body;
    console.log(data);
    await Todont.add(data.text, data.priority)
    res.sendStatus(200);
}));

/*
        Account Registration
*/
app.get("/register", errorHandler(async (req, res) => {
    res.sendFile(path.join(__dirname, "public", "html", "register.html"));
}));

app.post("/register", errorHandler(async (req, res) => {
    const body = req.body;
    if (body === undefined || (!body.username || !body.password)) {
        return res.sendStatus(400);
    }
    const {username, password} = body;
    try {
        await Auth.register(username, password);
        res.sendStatus(200);
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
            console.error(err);
            logger.error(err);
            res.sendStatus(409); // 409 Conflict
        } else {
            throw err;
        }
    }
}));

/*
        User Login
*/
app.get("/login", errorHandler(async (req, res) => {
    res.sendFile(path.join(__dirname, "public", "html", "login.html"));
}));

app.post("/login", errorHandler( async (req, res) => {
    if (req.body === undefined || (!req.body.username || !req.body.password)) {
        return res.sendStatus(400);
    }
    const {username, password} = req.body;
    const isVerified = await Auth.login(username, password);
    const status = isVerified ? 200 : 401;
    res.sendStatus(status);
}));

/*
        Error Pages
*/
// This sends back the error page
app.get('/error', (req, res) => res.sendFile(path.join(__dirname, 'public', 'html', 'error.html')));
// which hits this route to get a random error gif
app.get('/error_background', (req, res) => {
    const gifNum = Math.floor(Math.random() * 9) + 1;
    res.sendFile(path.join(__dirname, 'public', 'error_gifs', `error${gifNum}.gif`));
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

// This is our default error handler (the error handler must be last)
// it just logs the call stack and send back status 500
app.use(function (err, req, res, next) {
    console.error(err.stack)
    logger.error(err);
    res.sendStatus(500);
});

// We just use this to catch any error in our routes so they hit our default
// error handler. We only need to wrap async functions being used in routes
function errorHandler (fn) {
    return function(req, res, next) {
      return fn(req, res, next).catch(next);
    };
};