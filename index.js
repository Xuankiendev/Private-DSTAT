const http = require("http");
const fs = require("fs").promises;
const WebSocket = require("ws");
const cluster = require("cluster");
const os = require("os");

const cpus = os.cpus().length;
const port = 2011;

if (cluster.isMaster) {
    console.log(`--> Private DSTAT made with <3 by Pingu.`);
    console.log(`--! Server is listening to port ${port}. You can edit this inside index.js.`);
    console.log(`--> Master Thread ${process.pid} is spawned.`);

    let requests = 0;
    const workers = [];

    for (let i = 0; i < cpus; i++) {
        const worker = cluster.fork();

        worker.on("message", () => {
            requests++;
        });

        worker.on("exit", (code, signal) => {
            console.log(`--! Worker Thread ${worker.process.pid} died. Respawning in 1 second (Code ${code} | Signal ${signal}).`);
            setTimeout(() => workers.push(cluster.fork()), 1000);
        });

        workers.push(worker);
    }

    setInterval(() => {
        workers.forEach((worker) => worker.send(requests));
        requests = 0;
    }, 1000);
} else {
    console.log(`--> Worker Thread ${process.pid} spawned.`);

    const server = http.createServer(async (req, res) => {
        try {
            if (req.url === "/hit") {
                process.send(1);
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end(await fs.readFile("./htmls/hit.html"));
            } else if (req.url === "/exports/highcharts.js") {
                res.writeHead(200, { "Content-Type": "application/javascript" });
                res.end(await fs.readFile("./exports/highcharts.js"));
            } else if (req.url === "/exports/exporting.js") {
                res.writeHead(200, { "Content-Type": "application/javascript" });
                res.end(await fs.readFile("./exports/exporting.js"));
            } else {
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end(await fs.readFile("./htmls/index.html"));                
            }            
        } catch (err) {
            console.error(`--! Error serving request ${err}.`);
            res.writeHead(500, { "Content-Type": "text/html" });
            res.end(await fs.readFile("./htmls/error.html"));
        }
    });

    const wss = new WebSocket.Server({ server });
    let activeClients = 0;

    wss.on("connection", (ws) => {
        activeClients++;
        console.log(`--> New connection. Active clients ${activeClients}.`);

        ws.on("close", () => {
            activeClients--;
            console.log(`--> Connection closed. Active clients ${activeClients}.`);
        });

        ws.on("error", (err) => {
            console.error(`--! WebSocket error ${err}`);
        });
    });

    process.on("message", (requests) => {
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(requests);
            }
        });
    });

    process.on("SIGINT", () => {
        console.log(`--> Worker Thread ${process.pid} shutting down.`);
        process.exit();
    });

    server.listen(port);
}
