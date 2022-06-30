const { app, BrowserWindow } = require("electron");
const fetch = require("node-fetch");

const serviceInfoUrl = "http://plackistatus.000webhostapp.com";

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        center: true,
        title: "placki"
    });

    win.menuBarVisible = false;
    win.loadFile("loading.html");

    fetch(serviceInfoUrl + "/status.json")
        .then(response => {
            if (response.ok) {
                return response.json();
            }

            throw new Error();
        })
        .then(statusData => {
            const { url, maintenance } = statusData;

            if (maintenance) {
                win.loadFile("maintenance.html");
            } else {
                win.loadURL(url);
            }
        })
        .catch(() => {
            win.loadFile("error.html");
        });
};

app.whenReady().then(() => {
    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});