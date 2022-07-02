const { ipcRenderer } = require("electron");

ipcRenderer.on("changeText", (event, message) => {
    document.getElementsByTagName("p")[0].innerText = String(message);
});

ipcRenderer.on("progress", (event, message) => {
    console.log(message);
    document.getElementById("progress-bar").style.display = "block";
    /** @type {HTMLDivElement} */
    const progressDiv = document.querySelector("#progress-bar > div");
    progressDiv.style.width = `${message}%`;
    document.getElementById("progress-bar-text").innerText = `${message}%`;
});

ipcRenderer.on("hideProgress", () => {
    document.getElementById("progress-bar").style.display = "none";
    document.getElementById("progress-bar-text").innerText = "";
});