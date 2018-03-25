var shell = require('electron').shell;
var ext = document.querySelector('a.external-link');

ext.addEventListener('click', openExternal);

function openExternal(e) {
    e.preventDefault();
    shell.openExternal(this.href);
}