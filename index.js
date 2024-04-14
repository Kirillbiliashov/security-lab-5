const uuid = require('uuid');
const express = require('express');
const onFinished = require('on-finished');
const bodyParser = require('body-parser');
const path = require('path');
const port = 3000;
const fs = require('fs');
const axios = require('axios');
const { auth, requiredScopes } = require('express-oauth2-jwt-bearer');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const SESSION_KEY = 'Authorization';

class Session {
    #sessions = {}

    constructor() {
        try {
            this.#sessions = fs.readFileSync('./sessions.json', 'utf8');
            this.#sessions = JSON.parse(this.#sessions.trim());

            console.log(this.#sessions);
        } catch(e) {
            this.#sessions = {};
        }
    }

    #storeSessions() {
        fs.writeFileSync('./sessions.json', JSON.stringify(this.#sessions), 'utf-8');
    }

    set(key, value) {
        if (!value) {
            value = {};
        }
        this.#sessions[key] = value;
        this.#storeSessions();
    }

    get(key) {
        return this.#sessions[key];
    }

    init(res) {
        const sessionId = uuid.v4();
        this.set(sessionId);

        return sessionId;
    }

    destroy(req, res) {
        const sessionId = req.sessionId;
        delete this.#sessions[sessionId];
        this.#storeSessions();
    }
}

const sessions = new Session();


app.use((req, res, next) => {
    let currentSession = {};
    var sessionId = req.get(SESSION_KEY)

    if (sessionId) {
        currentSession = sessions.get(sessionId.slice('Bearer '.length));
        if (!currentSession) {
            currentSession = {};
        }
        auth({
            audience: 'https://dev-rutqozqdztmti8nn.us.auth0.com/api/v2/',
            issuerBaseURL: 'https://dev-rutqozqdztmti8nn.us.auth0.com/'
        })(req, res, next);
    } 
    req.session = currentSession;

    next();
});

app.get('/', (req, res) => {
    if (req.session.username) {
        return res.json({
            username: req.session.username,
            logout: 'http://localhost:3000/logout'
        })
    }
    res.sendFile(path.join(__dirname+'/index.html'));
})

app.get('/logout', (req, res) => {
    sessions.destroy(req, res);
    res.redirect('/');
});


app.post('/api/login', async (req, res) => {
    const { login, password } = req.body;

    try {
        const tokenResponse = await axios.post('https://dev-rutqozqdztmti8nn.us.auth0.com/oauth/token', {
            grant_type: 'password',
            username: login,
            password: password,
            audience: 'https://dev-rutqozqdztmti8nn.us.auth0.com/api/v2/',
            scope: 'offline_access',
            client_id: 'R7d5omgN3CghZgwlHmeP5AVubR2qadtz',
            client_secret: 'ggFspuvuvt66-9X7dDEM6iTvY1-l7Ppq70RrC0JVFyw5ymhi5GfpD1J38bYEx_7t'
        }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token } = tokenResponse.data;

        req.session = {};
        req.session.username = login;
        req.session.password = password;
        
        sessions.set(access_token, req.session);
        res.json({ token: access_token });
    } catch (error) {
        console.log(`error: ${error}`)
        res.status(401).send();
    }
    
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})