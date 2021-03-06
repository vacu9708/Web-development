'use strict'
const express = require('express');
const backend = express();
var server = require('http').createServer(backend);
var socket = require('socket.io')(server);
const path = require('path') 
const serve_static = require('serve-static') // To access files
const session = require('express-session');
const mysql = require('mysql')
const dbconfig = require('./config/dbconfig.json') // To hide sensitive information in a json file

// Pool : 
// pre-made connections between node.js and database to avoid creating and breaking connections and have stable connections.
const pool = mysql.createPool({
    connectionLimit: 10,
    host: dbconfig.host,
    user: dbconfig.user,
    password: dbconfig.password,
    database: dbconfig.database,
    debug: false
})

// Configuration for clients
backend.use(express.urlencoded({extended:true})) // Receive extended methods to encode URL
backend.use(express.json())
backend.use('/public', serve_static(path.join(__dirname, 'public'))) // Setting so that /public directory can be used
backend.use('/node_modules/socket.io/client-dist', express.static(__dirname+'/node_modules/socket.io/client-dist')) // socket.io

// Session setting
backend.use(session({
    //httpOnly: true,	// Session cookie cannot be modified by javascript
    //secure: true,	// Session cookie only available in https
    secret: 'secret key', // hash key to be used for encryption
    resave: false,
    saveUninitialized: true,
}));

// Get request configuration
backend.get("/", (req, res) => {
    res.redirect('/public/Login.html')
});
backend.get("/Observation", (req, res) => {
    if(req.session.user) // If logged in
       res.sendFile(__dirname+'/staff_only/Observation.html');
    else // Access without login
        res.send("<script>alert('Invalid access'); location.href='/public/Login.html';</script>");
});
backend.post("/process/detection", (req, res) => { // Request from python
    console.log(req.body);
    socket.emit('message from python', req.body.message);
});

// Set what to do when a post request from '/process/login' arrives
backend.post('/process/login', (request, response)=>{
    console.log('/process/login called '+request);
    const param_ID = request.body.id;
    const param_password = request.body.password;
    
    console.log('login request: '+param_ID+' '+param_password);

    pool.getConnection((error, connection)=> {
        if(error){ // DB connection failed
            console.dir(error);
            response.writeHead('200', {'Content-Type':'text/html; charset=utf8'})
            response.write('<h1>DB backend connection failed</h1>')
            response.end();
            connection.release();
            return;
        }
        console.log('Database connection successful');

        connection.query("select `id`, `password` from `users` where `id`=? and `password`=sha2(?,512);",
            [param_ID, param_password], // Password is encrypted by SHA2.
            (error, row)=>{
                connection.release();

                if(error){
                    console.dir(error);
                    response.writeHead('200', {'Content-Type':'text/html; charset=utf8'})
                    response.write('<h1>SQL execution failed</h1>')
                    response.end();
                    return;
                }

                if(row.length > 0){ // If a row that has the matching ID and password exists
                    console.dir(row)
                    
                    if(request.session.user == undefined)
                        request.session.user = {
                            id: param_ID,
                            authorized: true
                        };

                    response.send("<script>alert('Login successful'); location.href='/Observation';</script>");
                    response.end();
                }
                else{ // Login failed
                    console.dir(row)
                    response.send("<script>alert('Login failed'); location.href='/public/Login.html';</script>");
                    response.end();
                }
            }
        )
    })
})

// Set what to do when a post request from '/process/add_user' arrives
backend.post('/process/add_user', (request,response)=>{
    console.log('process/add_user called '+request)
    // Get information from the HTML
    const param_ID = request.body.id;
    const param_password = request.body.password;
    const param_name = request.body.name;

    pool.getConnection((error, connection)=>{ // Connect to database
        if(error){ // Error check
            console.log('DB backend connection failed. aborted')
            console.dir(error);
            response.writeHead('200', {'Content-Type':'text/html; charset=utf8'})
            response.write('<h1>DB backend connection failed</h1>')
            response.end();
            connection.release();
            return;
        }
        console.log('Database connection successful');

        const execution = connection.query('INSERT INTO users(id, password, name) VALUES(?, sha2(?,512), ?);',
            [param_ID, param_password, param_name], // password is encrypted by SHA2 algorithm.
            (error, result)=>{
                connection.release();
                console.log('Executed SQL: '+execution.sql);

                if(error){
                    console.log('SQL execution failed');
                    console.log(error);
                    response.writeHead('200', {'Content-Type':'text/html; charset=utf8'})
                    response.write('<h1>SQL execution failed</h1>')
                    response.end();
                    return;
                }

                console.log('Insert successful')
                console.dir(result)
                response.writeHead('200', {'Content-Type':'text/html; charset=utf8'}) // 200: Success code
                response.write('<h2>User successfuly added</h2>')
                response.end();
            }
        )
    })
})

server.listen(3000, ()=>{
    console.log('Listening on port 3000')
})