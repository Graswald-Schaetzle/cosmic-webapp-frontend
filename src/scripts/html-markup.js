import {initPopUpListeners} from "./matterport";

const commonElements = {
    matterportIframe: document.querySelector('#matterport-iframe'),
    createTaskButton: document.querySelector('#create-task-button'),
    tagControlContainer: document.querySelector('.tag-control-container'),
    tagControlContainerBg: document.querySelector('.tag-control-container .bg'),
}

const clerk = {
    signInModal: document.querySelector('#clerk-sign-in-modal'),
    userButton: document.querySelector('#clerk-user-button'),
}

const matterportUI = {
    background: '#mattertag-container #screen-bg',
    mattartagPopUp: '#mattertag-popup',
    objectButton: '#mattertag-popup .mode .object',
    documentsButton: '#mattertag-popup .mode .documents',

    taskPopUp: '#task-popup',
    taskBackButton: '#task-popup .back-button',
    taskEditButton: '#task-popup .edit-button',

    editTaskPopUp: '#edit-task-popup',
    editTaskBackButton: '#edit-task-popup .back-button',
    editTaskEditButton: '#edit-task-popup .edit-button',
    editTaskCancelButton: '#edit-task-popup .button.cancel',
    editTaskSaveButton: '#edit-task-popup .button.save',
}

async function loadHTMLMarkup() {
    await loadHTML('#mattertag-container', './html/mattertag-container.html',
        matterportUI, initPopUpListeners);

    async function loadHTML(selector, url, obj, listenersFunction) {
        const container = document.querySelector(selector);
        if (container) {
            const res = await fetch(url);
            const html = await res.text();
            document.querySelector(selector).innerHTML = html;


            Object.keys(obj).forEach(key => {
                obj[key] = document.querySelector(obj[key]);
            });
            listenersFunction()
        }
    }
}


export const htmlMarkup = {
    loadHTMLMarkup,
    commonElements,
    clerk,
    matterportUI,
}
